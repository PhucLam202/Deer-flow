# SRS Backend API DeerFlow

**Phiên bản tài liệu:** 1.0  
**Nguồn tham chiếu:** mã nguồn hiện tại trong `backend/app/gateway/routers` và `backend/app/gateway/app.py`  
**Ngày lập tài liệu:** 2026-04-15

## 1. Mục tiêu

Tài liệu này đặc tả toàn bộ HTTP API hiện đang được triển khai trong backend của DeerFlow. Mục tiêu là gom tất cả endpoint hiện có thành một SRS thống nhất để:

- Làm tài liệu chuẩn cho frontend, QA và tích hợp bên thứ ba.
- Mô tả rõ request, response, hành vi lỗi và ràng buộc chính.
- Tách phần API public của gateway khỏi logic nội bộ của agent/runtime.

## 2. Phạm vi

Tài liệu bao gồm:

- API Gateway FastAPI tại `/api/*`
- Health check tại `/health`
- Các endpoint theo thread, run, upload, artifact, memory, skills, MCP, agents, channels, suggestions, assistants compatibility

Tài liệu không bao gồm:

- Các class, hàm nội bộ không expose qua HTTP
- Luồng giao tiếp nội bộ giữa gateway, LangGraph runtime, sandbox, store, checkpointer
- UI, CLI hoặc kênh IM cụ thể ngoài các endpoint quản lý channel

## 3. Tổng quan kiến trúc API

Backend hiện chia thành hai lớp chính:

1. **Gateway API**: REST API do FastAPI phục vụ, dùng cho quản trị tài nguyên, thread, upload, artifact, memory, skills, agents và các API compatibility.
2. **Runtime API logic**: các endpoint thread/run gọi vào checkpointer, run manager và stream bridge để phục vụ chạy agent và streaming SSE.

### 3.1 Giao thức

- JSON over HTTP cho đa số endpoint.
- `multipart/form-data` cho upload file.
- `text/event-stream` cho các endpoint stream SSE.

### 3.2 Xác thực và phân quyền

- Code hiện tại không có cơ chế authentication/authorization ở tầng FastAPI.
- Một số chức năng được bảo vệ bằng cấu hình:
  - `agents` API chỉ hoạt động khi `agents_api.enabled = true`.
  - Nếu một dependency runtime chưa sẵn sàng, API trả `503`.
- Kiểm soát truy cập thực tế có thể được đặt ở Nginx hoặc lớp hạ tầng bên ngoài.

## 4. Tác nhân sử dụng

| Tác nhân | Mục đích |
| --- | --- |
| Frontend web app | Gọi API để hiển thị model, memory, skills, thread, run, artifact |
| Agent runtime | Tạo, cập nhật và truy vấn thread/run state |
| Admin/ops | Quản lý MCP, channels, agents, user profile |
| Tích hợp bên thứ ba | Dùng các endpoint compatibility cho LangGraph SDK |

## 5. Quy ước lỗi

Các endpoint trả lỗi chuẩn FastAPI/HTTP:

| Mã | Ý nghĩa |
| --- | --- |
| `400` | Dữ liệu đầu vào không hợp lệ hoặc yêu cầu không được phép theo logic nghiệp vụ |
| `401/403` | Không có quyền hoặc API bị tắt bởi cấu hình |
| `404` | Tài nguyên không tồn tại |
| `409` | Xung đột trạng thái, ví dụ run không cancel được hoặc agent/skill đã tồn tại |
| `422` | Validation thất bại ở schema hoặc tham số |
| `500` | Lỗi nội bộ |
| `503` | Dependency runtime chưa sẵn sàng |

## 6. Danh mục endpoint

### 6.1 Health

| Method | Path | Mục đích | Response |
| --- | --- | --- | --- |
| `GET` | `/health` | Kiểm tra dịch vụ đang hoạt động | `{"status":"healthy","service":"deer-flow-gateway"}` |

### 6.2 Models

| Method | Path | Mục đích | Input | Response |
| --- | --- | --- | --- | --- |
| `GET` | `/api/models` | Liệt kê toàn bộ model cấu hình | Không | `ModelsListResponse` |
| `GET` | `/api/models/{model_name}` | Lấy chi tiết một model | `model_name` path | `ModelResponse` |

#### Yêu cầu nghiệp vụ

- Chỉ trả metadata an toàn, không lộ API key hoặc secret.
- Nếu `model_name` không tồn tại, trả `404`.

### 6.3 MCP

| Method | Path | Mục đích | Input | Response |
| --- | --- | --- | --- | --- |
| `GET` | `/api/mcp/config` | Đọc cấu hình MCP hiện tại | Không | `McpConfigResponse` |
| `PUT` | `/api/mcp/config` | Ghi đè cấu hình MCP và reload cache | `McpConfigUpdateRequest` | `McpConfigResponse` |

#### Yêu cầu nghiệp vụ

- Khi cập nhật MCP, hệ thống phải giữ nguyên phần `skills` hiện có trong file cấu hình.
- Nếu không tìm thấy file cấu hình hiện hữu, backend tự tạo file mới ở project root phù hợp.
- Lỗi ghi file trả `500`.

### 6.4 Memory

| Method | Path | Mục đích | Input | Response |
| --- | --- | --- | --- | --- |
| `GET` | `/api/memory` | Lấy toàn bộ memory hiện tại | Không | `MemoryResponse` |
| `POST` | `/api/memory/reload` | Reload memory từ storage | Không | `MemoryResponse` |
| `DELETE` | `/api/memory` | Xóa toàn bộ memory | Không | `MemoryResponse` |
| `POST` | `/api/memory/facts` | Tạo một memory fact | `FactCreateRequest` | `MemoryResponse` |
| `DELETE` | `/api/memory/facts/{fact_id}` | Xóa fact theo id | `fact_id` path | `MemoryResponse` |
| `PATCH` | `/api/memory/facts/{fact_id}` | Cập nhật từng phần fact | `FactPatchRequest` | `MemoryResponse` |
| `GET` | `/api/memory/export` | Export memory hiện tại | Không | `MemoryResponse` |
| `POST` | `/api/memory/import` | Import và ghi đè memory | `MemoryResponse` | `MemoryResponse` |
| `GET` | `/api/memory/config` | Lấy cấu hình memory | Không | `MemoryConfigResponse` |
| `GET` | `/api/memory/status` | Lấy đồng thời config và data | Không | `MemoryStatusResponse` |

#### Yêu cầu nghiệp vụ

- `confidence` của fact phải nằm trong `[0, 1]`.
- `content` fact không được rỗng.
- `fact_id` không tồn tại trả `404`.
- `clear`, `import`, `create`, `update`, `delete` đều phải trả về trạng thái memory mới nhất sau thao tác.

### 6.5 Skills

| Method | Path | Mục đích | Input | Response |
| --- | --- | --- | --- | --- |
| `GET` | `/api/skills` | Liệt kê tất cả skills | Không | `SkillsListResponse` |
| `POST` | `/api/skills/install` | Cài skill từ file `.skill` | `SkillInstallRequest` | `SkillInstallResponse` |
| `GET` | `/api/skills/custom` | Liệt kê custom skills | Không | `SkillsListResponse` |
| `GET` | `/api/skills/custom/{skill_name}` | Lấy nội dung custom skill | `skill_name` path | `CustomSkillContentResponse` |
| `PUT` | `/api/skills/custom/{skill_name}` | Chỉnh sửa custom skill | `CustomSkillUpdateRequest` | `CustomSkillContentResponse` |
| `DELETE` | `/api/skills/custom/{skill_name}` | Xóa custom skill | `skill_name` path | `{ "success": true }` |
| `GET` | `/api/skills/custom/{skill_name}/history` | Xem lịch sử sửa đổi | `skill_name` path | `CustomSkillHistoryResponse` |
| `POST` | `/api/skills/custom/{skill_name}/rollback` | Rollback custom skill | `SkillRollbackRequest` | `CustomSkillContentResponse` |
| `GET` | `/api/skills/{skill_name}` | Lấy chi tiết skill bất kỳ | `skill_name` path | `SkillResponse` |
| `PUT` | `/api/skills/{skill_name}` | Bật/tắt skill | `SkillUpdateRequest` | `SkillResponse` |

#### Yêu cầu nghiệp vụ

- Chỉ custom skill mới có API edit/delete/history/rollback.
- Update/delete custom skill phải chạy kiểm tra an toàn nội dung trước khi ghi.
- Rollback theo `history_index`, mặc định là phần tử cuối.
- `install` skill từ file `.skill` phải xác thực đường dẫn thread và file nguồn.

### 6.6 Threads

| Method | Path | Mục đích | Input | Response |
| --- | --- | --- | --- | --- |
| `DELETE` | `/api/threads/{thread_id}` | Xóa dữ liệu thread trên filesystem, store và checkpoint | `thread_id` path | `ThreadDeleteResponse` |
| `POST` | `/api/threads` | Tạo thread mới | `ThreadCreateRequest` | `ThreadResponse` |
| `POST` | `/api/threads/search` | Tìm thread theo metadata/status | `ThreadSearchRequest` | `list[ThreadResponse]` |
| `PATCH` | `/api/threads/{thread_id}` | Gộp metadata vào thread | `ThreadPatchRequest` | `ThreadResponse` |
| `GET` | `/api/threads/{thread_id}` | Lấy thông tin thread | `thread_id` path | `ThreadResponse` |
| `GET` | `/api/threads/{thread_id}/state` | Lấy snapshot state mới nhất | `thread_id` path | `ThreadStateResponse` |
| `POST` | `/api/threads/{thread_id}/state` | Cập nhật state, phục vụ resume human-in-the-loop | `ThreadStateUpdateRequest` | `ThreadStateResponse` |
| `POST` | `/api/threads/{thread_id}/history` | Lấy lịch sử checkpoint | `ThreadHistoryRequest` | `list[HistoryEntry]` |

#### Yêu cầu nghiệp vụ

- `POST /api/threads` phải idempotent theo `thread_id` nếu thread đã tồn tại.
- `search` phải lọc theo `metadata`, `status`, `limit`, `offset`.
- `get state` và `history` lấy dữ liệu từ checkpointer.
- `update state` phải tạo checkpoint mới và đồng bộ `title` vào store nếu có.
- `delete` phải best-effort xóa mọi dữ liệu liên quan.

### 6.7 Runs theo thread

| Method | Path | Mục đích | Input | Response |
| --- | --- | --- | --- | --- |
| `POST` | `/api/threads/{thread_id}/runs` | Tạo run nền và trả ngay | `RunCreateRequest` | `RunResponse` |
| `POST` | `/api/threads/{thread_id}/runs/stream` | Tạo run và stream SSE | `RunCreateRequest` | SSE |
| `POST` | `/api/threads/{thread_id}/runs/wait` | Tạo run và chờ hoàn tất | `RunCreateRequest` | `dict` |
| `GET` | `/api/threads/{thread_id}/runs` | Liệt kê runs của thread | Không | `list[RunResponse]` |
| `GET` | `/api/threads/{thread_id}/runs/{run_id}` | Lấy chi tiết run | Path | `RunResponse` |
| `POST` | `/api/threads/{thread_id}/runs/{run_id}/cancel` | Hủy run | Query `wait`, `action` | `204` hoặc `202` |
| `GET` | `/api/threads/{thread_id}/runs/{run_id}/join` | Join SSE của run đang có | Không | SSE |
| `GET`/`POST` | `/api/threads/{thread_id}/runs/{run_id}/stream` | Join SSE hoặc cancel-then-stream | Query `action`, `wait` | SSE hoặc `204` |

#### Yêu cầu nghiệp vụ

- `action` của cancel chỉ nhận `interrupt` hoặc `rollback`.
- Nếu `wait=true`, endpoint cancel phải block đến khi task kết thúc rồi trả `204`.
- `Content-Location` trong SSE phải trỏ đúng run resource canonical.
- `join` và `stream` phải trả `404` nếu run không thuộc thread tương ứng.

### 6.8 Runs stateless

| Method | Path | Mục đích | Input | Response |
| --- | --- | --- | --- | --- |
| `POST` | `/api/runs/stream` | Tạo run không cần thread trước đó | `RunCreateRequest` | SSE |
| `POST` | `/api/runs/wait` | Tạo run không cần thread trước đó và chờ | `RunCreateRequest` | `dict` |

#### Yêu cầu nghiệp vụ

- Nếu request có `config.configurable.thread_id`, phải reuse thread đó.
- Nếu không có `thread_id`, backend phải tự sinh thread tạm.

### 6.9 Uploads

| Method | Path | Mục đích | Input | Response |
| --- | --- | --- | --- | --- |
| `POST` | `/api/threads/{thread_id}/uploads` | Upload nhiều file | `multipart/form-data` với `files[]` | `UploadResponse` |
| `GET` | `/api/threads/{thread_id}/uploads/list` | Liệt kê file đã upload | Không | `dict` |
| `DELETE` | `/api/threads/{thread_id}/uploads/{filename}` | Xóa file upload | `filename` path | `dict` |

#### Yêu cầu nghiệp vụ

- Chỉ chấp nhận filename an toàn, đã normalize.
- Nếu file convertible, backend có thể sinh thêm file markdown kèm metadata.
- Upload thành công phải trả path artifact và virtual path để frontend dùng tiếp.
- Xóa file không tồn tại trả `404`.

### 6.10 Artifacts

| Method | Path | Mục đích | Input | Response |
| --- | --- | --- | --- | --- |
| `GET` | `/api/threads/{thread_id}/artifacts/{path:path}` | Đọc artifact theo virtual path | `download` query tùy chọn | `FileResponse`, `PlainTextResponse` hoặc `Response` |

#### Yêu cầu nghiệp vụ

- Endpoint phải chặn path traversal bằng cơ chế resolve virtual path.
- Các file HTML/XHTML/SVG phải luôn tải xuống để tránh chạy script trong origin ứng dụng.
- Nếu `path` trỏ vào nội dung trong `.skill`, backend phải đọc file trong archive.
- Nếu artifact là text, ưu tiên trả inline text/plain hoặc content type phù hợp.

### 6.11 Suggestions

| Method | Path | Mục đích | Input | Response |
| --- | --- | --- | --- | --- |
| `POST` | `/api/threads/{thread_id}/suggestions` | Sinh câu hỏi gợi ý tiếp theo | `SuggestionsRequest` | `SuggestionsResponse` |

#### Yêu cầu nghiệp vụ

- Nếu `messages` rỗng, phải trả danh sách rỗng.
- Output phải là `n` câu hỏi ngắn, cùng ngôn ngữ với user.
- Nếu model lỗi, backend trả danh sách rỗng thay vì fail toàn bộ request.

### 6.12 Channels

| Method | Path | Mục đích | Input | Response |
| --- | --- | --- | --- | --- |
| `GET` | `/api/channels/` | Lấy trạng thái toàn bộ IM channels | Không | `ChannelStatusResponse` |
| `POST` | `/api/channels/{name}/restart` | Restart một channel | `name` path | `ChannelRestartResponse` |

#### Yêu cầu nghiệp vụ

- Nếu channel service không chạy, trả `503`.
- Restart thất bại vẫn trả response hợp lệ với `success=false`.

### 6.13 Assistants compatibility

| Method | Path | Mục đích | Input | Response |
| --- | --- | --- | --- | --- |
| `POST` | `/api/assistants/search` | Tìm assistants tương thích LangGraph SDK | `AssistantSearchRequest` tùy chọn | `list[AssistantResponse]` |
| `GET` | `/api/assistants/{assistant_id}` | Lấy assistant theo id | `assistant_id` path | `AssistantResponse` |
| `GET` | `/api/assistants/{assistant_id}/graph` | Lấy mô tả graph tối thiểu | `assistant_id` path | `dict` |
| `GET` | `/api/assistants/{assistant_id}/schemas` | Lấy schema tối thiểu | `assistant_id` path | `dict` |

#### Yêu cầu nghiệp vụ

- Đây là stub compatibility cho LangGraph Platform.
- `search` phải luôn trả ít nhất `lead_agent` nếu hệ thống có thể khởi tạo.
- `graph` và `schemas` chỉ cần đủ để SDK validation hoạt động.

### 6.14 Agents

| Method | Path | Mục đích | Input | Response |
| --- | --- | --- | --- | --- |
| `GET` | `/api/agents` | Liệt kê custom agents | Không | `AgentsListResponse` |
| `GET` | `/api/agents/check?name=...` | Kiểm tra tên agent hợp lệ và còn trống | Query `name` | `{ available, name }` |
| `GET` | `/api/agents/{name}` | Lấy chi tiết agent | `name` path | `AgentResponse` |
| `POST` | `/api/agents` | Tạo custom agent | `AgentCreateRequest` | `AgentResponse` |
| `PUT` | `/api/agents/{name}` | Cập nhật custom agent | `AgentUpdateRequest` | `AgentResponse` |
| `DELETE` | `/api/agents/{name}` | Xóa custom agent | `name` path | `204 No Content` |
| `GET` | `/api/user-profile` | Đọc `USER.md` global | Không | `UserProfileResponse` |
| `PUT` | `/api/user-profile` | Ghi `USER.md` global | `UserProfileUpdateRequest` | `UserProfileResponse` |

#### Yêu cầu nghiệp vụ

- Toàn bộ nhóm API này chỉ hoạt động khi `agents_api.enabled = true`.
- Tên agent phải match `^[A-Za-z0-9-]+$`.
- Tên agent được normalize về lowercase khi lưu trữ.
- Tạo agent phải ghi `config.yaml` và `SOUL.md`.
- Cập nhật agent phải hỗ trợ đổi `description`, `model`, `tool_groups`, `soul` độc lập.
- Xóa agent phải xóa toàn bộ thư mục agent.

## 7. Mô hình dữ liệu chính

### 7.1 ModelResponse

- `name`
- `model`
- `display_name`
- `description`
- `supports_thinking`
- `supports_reasoning_effort`

### 7.2 ThreadResponse

- `thread_id`
- `status`
- `created_at`
- `updated_at`
- `metadata`
- `values`
- `interrupts`

### 7.3 RunResponse

- `run_id`
- `thread_id`
- `assistant_id`
- `status`
- `metadata`
- `kwargs`
- `multitask_strategy`
- `created_at`
- `updated_at`

### 7.4 MemoryResponse

- `version`
- `lastUpdated`
- `user`
- `history`
- `facts`

### 7.5 AgentResponse

- `name`
- `description`
- `model`
- `tool_groups`
- `soul`

## 8. Ràng buộc hệ thống

- FastAPI app phải khởi tạo `stream_bridge`, `checkpointer`, `store`, `run_manager` trong lifespan.
- Nếu dependency runtime không có, endpoint phụ thuộc phải trả `503`.
- SSE phải giữ định dạng tương thích LangGraph Platform để frontend `useStream` hoạt động.
- Một số endpoint chỉ hoạt động đúng khi reverse proxy/Nginx đã cấu hình trước.

## 9. Tiêu chí chấp nhận

API backend được xem là đạt yêu cầu khi:

- Mọi endpoint liệt kê ở trên tồn tại đúng method/path.
- Request/response schema khớp với code hiện tại.
- Các lỗi quan trọng trả mã trạng thái nhất quán.
- SSE, upload, artifact và thread/run flow hoạt động không phá vỡ tương thích frontend hiện tại.

## 10. Ghi chú triển khai

- Đây là SRS dựa trên code hiện tại, không phải contract đã đóng băng.
- Nếu bạn thay đổi router hoặc schema, tài liệu này cần được cập nhật tương ứng.
- Các file tài liệu API cũ như `backend/docs/API.md` có thể được giữ lại như reference, nhưng tài liệu này là bản tổng hợp hiện hành.
