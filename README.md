| PM2 | Port |
| --- | --- |
| `crm-frontend` | `5080` |
| `crm-backend` | `5002` |

Cloudflare: `/api`, `/uploads`, `/webhook`, `/webhooks` → backend; còn lại → frontend.
Cấu hình: [PM2](ecosystem.config.cjs) · [Ingress](deploy/crm-ingress.example.yml) · [Môi trường](.env.example).

## Dev

```bash
npm run dev
```

```bash
pm2 start crm-frontend
```

Dev localhost `:5174`: `npm run frontend:dev`.
## Deploy

| Thao tác | Lệnh |
| --- | --- |
| Build frontend | `npm run frontend:build` |
| Restart backend | `pm2 restart crm-backend` |
| Cập nhật env backend | `pm2 startOrRestart ecosystem.config.cjs --only crm-backend --update-env` |
| Reload Nginx | `npm run frontend:check && npm run frontend:reload` |

## Cài đặt

Cần Node.js, PostgreSQL, Redis, PM2, Nginx.

```bash
npm install
cp .env.example .env
```

Điền `.env`, cấu hình ingress, rồi:

```bash
npm run db:migrate
npm run frontend:build
npm run frontend:check
pm2 startOrRestart ecosystem.config.cjs --update-env
pm2 save
```

## Log và kiểm tra

```bash
npm run logs
npm run logs:details
npm run check
```

Healthcheck: `/api/health`. Kết nối Meta: `/meta-verification`.

## AI riêng và kho kiến thức

Trang `/ai` quản lý model Ollama, gợi ý tin nhắn, tự động trả lời, tài liệu và nhật ký.
Cần chạy `npm run db:migrate` và `npm run db:generate` trước khi restart backend.
`OLLAMA_URL` là địa chỉ dịch vụ model; `AI_CHAT_MODEL` chọn model mặc định đã cài sẵn.
Sau đó có thể đổi model và hướng dẫn tư vấn ngay trên trang AI, không cần restart.

Kho kiến thức kết hợp PostgreSQL full-text search và cosine similarity trên vector có số chiều theo model đã chọn, tìm trên toàn bộ tài liệu đang bật trước khi xếp hạng.
Chọn model embedding đã cài trong tab RAG trên trang AI. Backend kiểm tra model và tự nhận số chiều.
Đổi model sẽ đưa tài liệu vào hàng đợi lập lại chỉ mục; vector của các model được tách theo phiên bản.
`AI_EMBEDDING_MODEL` là giá trị mặc định khi khởi tạo cấu hình mới; `AI_EMBEDDING_MIN_SCORE` là ngưỡng cosine mặc định trước khi lưu thiết lập truy xuất trên giao diện.
Cài model bằng `ollama pull embeddinggemma:300m` trên máy chạy Ollama trước khi lập chỉ mục.
Chọn “Tải tài liệu lên” để nhập TXT/Markdown/DOCX, kiểm tra nội dung rồi lưu. Tất cả tài liệu dùng chung; tên thương hiệu từ số WhatsApp chỉ được dùng trong ngữ cảnh tư vấn.
DOCX được trích xuất văn bản ngay trong trình duyệt, gồm các đoạn và nội dung bảng; không đọc chữ trong ảnh và không giữ định dạng Word.
Sau khi tải lên, điều chỉnh dấu phân cách, độ dài đoạn, độ chồng lấn và quy tắc làm sạch văn bản; bấm xem trước để kiểm tra các đoạn rồi chọn “Lưu & xử lý”. Thiết lập được lưu theo từng tài liệu.
Mặc định chia theo ranh giới đoạn/câu khi có thể, tối đa 1.000 ký tự và chồng lấn khoảng 120 ký tự. Phần xem trước và API dùng chung hàm chia đoạn.
Worker lập chỉ mục theo batch ở nền, lưu trạng thái/lỗi trong database; có thể lập lại chỉ mục trên trang AI.
Vector được chuẩn hóa và lưu bằng PostgreSQL REAL[], tìm cosine chính xác; không cần extension pgvector.
Đây là quét vector chính xác, chưa có chỉ mục ANN: cần đánh giá tải và chuyển sang pgvector khi kho lớn.
Thiết lập truy xuất dùng chung cho toàn bộ kho: chọn Vector Search, Full-Text Search hoặc Hybrid Search; Top K từ 1 đến 20 (mặc định 5). Trang AI có hai tab thiết lập: “Trợ lý AI” lưu hồ sơ, model trả lời, gợi ý, tự động trả lời, hướng dẫn, thời gian chờ và tùy chọn dịch; “RAG” lưu model embedding, trạng thái tra cứu và thiết lập truy xuất. Mỗi tab có một nút “Lưu thay đổi”, chỉ ghi các trường của tab đó. Bản nháp chưa lưu của tab còn lại được giữ nguyên khi chuyển tab hoặc lưu. Tùy chọn dịch chỉ áp dụng sau khi lưu Trợ lý AI thành công; cấu hình và hồ sơ trợ lý được cập nhật trong cùng transaction.
Ở màn hình tải tài liệu, thiết lập truy xuất vẫn có nút lưu riêng để áp dụng cho toàn bộ kho.
Hybrid có hai cách xếp hạng: RRF giữ hành vi trước đây; Weighted Score kết hợp trọng số vector/từ khóa (mặc định 0,7/0,3), tổng luôn bằng 1. Điểm từ khóa được chuẩn hóa theo rank / (1 + rank), cosine được chặn trong [0,1], rồi cộng theo trọng số. Chọn Weighted Score trong tab RAG và lưu để áp dụng. Tắt RAG sẽ tắt tự động trả lời trong cùng transaction; cần bật và lưu RAG trước khi bật tự động trả lời.
Ngưỡng điểm bật/tắt được, từ 0 đến 1. Với Weighted Score, ngưỡng lọc điểm tổng hợp sau khi kết hợp; với Vector hoặc Hybrid RRF, ngưỡng chỉ lọc nhánh vector. Full-Text Search không dùng ngưỡng này. Số ứng viên mỗi nhánh là tối đa max(20, Top K × 4), sau đó lấy Top K nguồn.
Full-Text Search không gọi model embedding. Vector Search trả rỗng khi chưa có vector; Hybrid tiếp tục dùng từ khóa trong thời gian lập chỉ mục. Thay đổi thiết lập truy xuất xóa cache câu trả lời và không yêu cầu lập lại chỉ mục.
Điểm cosine không phải xác suất câu trả lời đúng; ngưỡng cần được hiệu chỉnh bằng bộ câu hỏi thực tế.
Khi chưa có vector, vẫn tra cứu từ khóa và ghi rõ phương thức trên nguồn; khi model embedding lỗi, trả mã lỗi rõ ràng.
Chưa có model cross-encoder rerank. Tài liệu từ Dify chưa được nhập tự động.
Giá, tồn kho và trạng thái đơn chưa được nối thành công cụ tra cứu trực tiếp cho model.

Tự động trả lời mặc định tắt. Thử AI và duyệt tài liệu trước khi bật.
Khu thử không gửi WhatsApp. Gợi ý và tự động trả lời gọi Ollama trực tiếp, không qua Dify.
Backend kiểm tra schema JSON và nguồn trích dẫn, lưu output gốc cùng mã lần chạy trong nhật ký.
Câu trả lời tự động cần nguồn hợp lệ; việc có trích dẫn không tự bảo đảm mọi nội dung đều đúng.
Khi nhân viên gửi tin, AI tạm dừng 30 phút theo đúng số WhatsApp doanh nghiệp.
Không tự gửi lại khi lần gửi trước có kết quả không rõ ràng; kiểm tra nhật ký và Meta trước khi xử lý thủ công.
