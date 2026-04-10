# Ứng Dụng Nghe Nhạc Trực Tuyến — Tài Liệu Yêu Cầu Sản Phẩm
**Phiên bản 3.0 · Tháng 3 năm 2026**

> Giải pháp thay thế Spotify tự host, không quảng cáo dành cho cộng đồng nhỏ (20–200 người dùng).

**v3.0 bổ sung:** Tải nhạc ngoại tuyến (BL-52–58) · Tính năng Ra mắt trực tiếp của Nghệ sĩ (BL-59–65)

---

## 1. Giới Thiệu

Tài liệu này là nguồn thông tin duy nhất và chính thức cho toàn bộ logic nghiệp vụ, vai trò, yêu cầu tính năng và yêu cầu phi chức năng của Ứng Dụng Nghe Nhạc Trực Tuyến. Phiên bản 3.0 bổ sung hai tính năng cao cấp: **Tải nhạc ngoại tuyến** và **Ra mắt trực tiếp của Nghệ sĩ**.

### 1.1 Nguyên Tắc Thiết Kế

- Nghệ sĩ và Admin có thể tải nhạc lên. Người dùng chỉ là thính giả và người quản lý playlist.
- Tất cả các bài tải lên (bất kể vai trò) đều có trạng thái `PENDING` và cần Admin duyệt trước khi công khai.
- Nghệ sĩ tự đăng ký — không có quy trình phê duyệt tài khoản riêng.
- Vai trò có tính cộng gộp: một người dùng có thể đồng thời giữ `ARTIST + PREMIUM` (được mô hình hóa dưới dạng bảng liên kết nhiều-nhiều).
- Thể loại nhạc được mở rộng từ gợi ý của nghệ sĩ do Admin xem xét, cung cấp dữ liệu cho bộ máy gợi ý AI.
- Tải xuống ngoại tuyến sử dụng mã hóa DRM nhẹ — AES-256 cho mỗi bài nhạc, JWT bản quyền cho mỗi người dùng.
- Các bản phát hành đã lên lịch được kích hoạt qua cron theo từng phút — tất cả quá trình chuyển `SCHEDULED → LIVE` đều tự động.

### 1.2 Giả Định Về Tech Stack

| Tầng | Công nghệ |
|---|---|
| Backend | NestJS / TypeORM |
| Xác thực | JWT (access + refresh token), bcrypt (rounds = 10) |
| Thanh toán | VNPay, MoMo |
| Tác vụ lên lịch | Cron jobs (bao gồm cron theo phút để kích hoạt drop) |
| Lưu trữ | File server với các biến thể `.enc` đã mã hóa cho nhạc tải về |
| AI | Bộ máy dựa trên quy tắc hiện tại; lộ trình tích hợp ML được giữ mở |

---

## 2. Vai Trò & Phân Quyền

Hệ thống có ba vai trò. `PREMIUM` là cấp độ thanh toán, chồng lên `USER` hoặc `ARTIST` — không phải vai trò riêng biệt. Tất cả vai trò được lưu trong bảng liên kết `user_roles` (nhiều-nhiều), không bao giờ là một cột enum đơn lẻ.

| Vai trò | Đối tượng | Đặc quyền cốt lõi |
|---|---|---|
| USER | Thính giả, người quản lý playlist | Nghe nhạc, thích, theo dõi, tạo playlist. Không thể tải lên. |
| ARTIST | Nhạc sĩ — tự đăng ký khi tạo tài khoản | Tất cả quyền của USER + tải bài lên, quản lý album, xem thống kê, trang hồ sơ công khai, lên lịch phát hành. |
| ADMIN | Quản trị viên nền tảng | Tất cả quyền của ARTIST + duyệt/từ chối nội dung, quản lý thể loại, nhật ký kiểm tra, tất cả phiên đăng nhập. |
| PREMIUM (cấp) | Nâng cấp trả phí — chồng lên USER hoặc ARTIST | Âm thanh 320 kbps, tải nhạc ngoại tuyến (100 bài), giới hạn tải lên cao hơn. Mở khóa qua VNPay hoặc MoMo (tự động), hoặc được Admin cấp thủ công. |

### 2.1 Ma Trận Phân Quyền

| Quyền | USER | ARTIST | ADMIN |
|---|---|---|---|
| **Nghe nhạc & Quản lý** | | | |
| Duyệt & nghe nhạc đã duyệt / đang phát | có | có | có |
| Thích bài nhạc, theo dõi nghệ sĩ & người dùng | có | có | có |
| Tạo & quản lý playlist cá nhân | có | có | có |
| Lưu / theo dõi playlist công khai | có | có | có |
| Báo cáo nội dung | có | có | có |
| Xem trang teaser drop (công khai) | có | có | có |
| Đăng ký nhận thông báo drop | có | có | có |
| **Tải ngoại tuyến — Chỉ PREMIUM** | | | |
| Tải bài nhạc để nghe ngoại tuyến | không | không | có |
| Tải bài nhạc (cấp PREMIUM) | — | → xét duyệt | có |
| Gia hạn giấy phép tải xuống | không | → xét duyệt | có |
| Xóa bài nhạc đã tải | không | → xét duyệt | có |
| **Tạo nội dung — Chỉ Artist & Admin** | | | |
| Tải bài nhạc lên (→ chờ duyệt) | không | → xét duyệt | → xét duyệt |
| Đặt ngày phát hành lên lịch khi tải lên | không | có | có |
| Hủy / dời lịch phát hành | không | chỉ của mình | có |
| Tạo & quản lý album | không | chỉ của mình | mọi album |
| Chỉnh sửa / xóa bài nhạc của mình | không | chỉ của mình | mọi bài |
| Trang hồ sơ nghệ sĩ công khai | không | có | có |
| Xem thống kê bài nhạc | không | chỉ của mình | mọi bài |
| Gợi ý thể loại mới khi tải lên | không | → xét duyệt | ngay lập tức |
| **Chỉ Admin** | | | |
| Duyệt / từ chối bài tải lên | không | không | có |
| Duyệt / từ chối gợi ý thể loại | không | không | có |
| Xóa bất kỳ nội dung nào | không | không | có |
| Giải quyết báo cáo nội dung | không | không | có |
| Quản lý danh sách thể loại đã xác nhận | không | không | có |
| Xem nhật ký kiểm tra & tất cả phiên | không | không | có |
| Thăng / giáng cấp vai trò người dùng | không | không | có |

---

## 3. Xác Thực & Đăng Ký

### Luồng Đăng Ký

| Mã | Tên | Mô tả |
|---|---|---|
| BL-01 | Đăng ký người dùng | `POST /auth/register` với `role=USER` (mặc định). Trường: `name`, `email`, `password`, `confirmPassword`. Kiểm tra email duy nhất, mật khẩu khớp, mã hóa bcrypt (rounds=10), gán vai trò USER, lưu người dùng với `is_email_verified=false`, tạo access + refresh token. Gửi mã xác minh email (6 chữ số, hết hạn sau 10 phút) bất đồng bộ qua bảng `verification_codes`. **Người dùng chưa xác minh có thể đăng nhập nhưng không thể nghe nhạc, thích bài, tạo playlist hoặc truy cập tính năng premium cho đến khi xác minh email (BL-78).** Trả về `TokenResponse`. |
| BL-46 | Đăng ký nghệ sĩ | `POST /auth/register` với `role=ARTIST`. Tất cả trường của BL-01 cộng thêm: `stageName` (bắt buộc), `bio` (bắt buộc), `genres[]` (bắt buộc, tối thiểu 1), `socialLinks[]` (tùy chọn). Xác thực tất cả trường nghệ sĩ trước khi tạo bản ghi. Thành công: tạo User (role=ARTIST) + ArtistProfile nguyên tử với `is_email_verified=false`. Gửi mã xác minh email tương tự BL-01. Nghệ sĩ chưa xác minh không thể tải nhạc lên. Trả về `TokenResponse`. |
| BL-47 | Bản ghi hồ sơ nghệ sĩ | `ArtistProfile` được tạo nguyên tử cùng với User khi đăng ký nghệ sĩ. Trường: `userId` (FK, unique), `stageName`, `bio`, `followerCount=0`, `socialLinks[]`, `suggestedGenres[]`. Công khai ngay qua `GET /artists/:id/profile` hiển thị stageName, bio, followerCount, và chỉ các bài LIVE. |

### Xác Minh Email

| Mã | Tên | Mô tả |
|---|---|---|
| BL-78 | Xác minh email | `POST /auth/verify-email`. Body: `{ email, code }`. Tìm `VerificationCode` theo email + mã. Kiểm tra chưa hết hạn. Đặt `is_email_verified=true` cho người dùng. Xóa bản ghi `VerificationCode`. Trả về `UserResponse`. |
| BL-79 | Gửi lại email xác minh | `POST /auth/resend-verification-email`. Đã xác thực. Nếu `is_email_verified=true`, trả về lỗi. Tạo mã 6 chữ số mới, lưu vào `verification_codes` (vô hiệu hóa mã cũ cùng email), gửi email xác minh. Trả về `VerificationCodeResponse`. |

### Quản Lý Hồ Sơ

| Mã | Tên | Mô tả |
|---|---|---|
| BL-66 | Cập nhật hồ sơ người dùng | `PATCH /users/me`. Chỉ người dùng đã xác thực. Các trường có thể cập nhật: `name`, `avatarUrl`. Kiểm tra name không rỗng. Trả về `UserResponse`. |
| BL-67 | Cập nhật hồ sơ nghệ sĩ | `PATCH /artists/me/profile`. Chỉ vai trò ARTIST. Các trường có thể cập nhật: `stageName`, `bio`, `avatarUrl`, `socialLinks[]`. Kiểm tra stageName không rỗng nếu được cung cấp. Trả về `ArtistProfileResponse`. |

### Đăng Nhập & Phiên

| Mã | Tên | Mô tả |
|---|---|---|
| BL-02 | Đăng nhập | Tìm người dùng bằng email (ném UNAUTHENTICATED nếu không tìm thấy). So sánh mật khẩu với bcrypt (ném UNAUTHENTICATED nếu không khớp). Kiểm tra tài khoản không bị khóa (BL-43). Tạo access + refresh token, lưu refresh token, tạo/cập nhật bản ghi Session (BL-42). Trả về `TokenResponse`. |
| BL-03 | Đăng xuất | Xác minh access token. Lưu `jti` + thời hạn vào bảng `InvalidatedToken` (danh sách đen). Vô hiệu hóa bản ghi Session liên kết. Trả về void. |
| BL-04 | Làm mới token | Xác minh chữ ký + thời hạn refresh token. Kiểm tra token tồn tại trong `tbl_refresh_token` và chưa hết hạn. Lấy người dùng từ claim `sub`. Tạo access token mới. Trả về `TokenResponse`. |
| BL-05 | Đổi mật khẩu | Lấy người dùng hiện tại từ JWT. Xác minh `oldPassword` khớp hash. Xác thực `newPassword == confirmPassword`. Mã hóa mật khẩu mới. Cập nhật người dùng trong DB. Trả về `UserResponse`. |

### Luồng Quên Mật Khẩu

| Mã | Tên | Mô tả |
|---|---|---|
| BL-06 | Quên mật khẩu | Nhận email. Tìm người dùng (ném lỗi nếu không tìm thấy). Tạo mã số 6 chữ số. Đặt thời hạn = hiện tại + 10 phút. Lưu `VerificationCode` vào DB. Gửi mã qua email. Trả về entity `VerificationCode`. |
| BL-07 | Xác minh mã | Tìm `VerificationCode` bằng email + mã. Kiểm tra chưa hết hạn. Tạo JWT đặt lại mật khẩu (thời hạn 15 phút). Lưu `ForgotPasswordToken` vào DB. Trả về entity `ForgotPasswordToken`. |
| BL-08 | Đặt lại mật khẩu | Tìm `ForgotPasswordToken` bằng chuỗi token. Xác minh JWT hợp lệ + chưa hết hạn. Xác thực `newPassword == confirmPassword`. Mã hóa + cập nhật mật khẩu người dùng. Xóa `ForgotPasswordToken`. Xóa tất cả `VerificationCode` của email đó. Trả về void. |

### Tăng Cường Bảo Mật

| Mã | Tên | Mô tả |
|---|---|---|
| BL-41 | Giới hạn tốc độ | Endpoint xác thực: tối đa 10 yêu cầu/phút mỗi IP. Endpoint tải lên: tối đa 5 yêu cầu/phút. API chung: tối đa 200 yêu cầu/phút. Trả về 429 kèm header `Retry-After` khi vượt quá. |
| BL-42 | Quản lý phiên thiết bị | Mỗi lần đăng nhập tạo bản ghi Session (`deviceName`, `deviceType`, IP, `lastSeenAt`, `refreshTokenId`). Phiên có TTL **30 ngày kể từ lần hoạt động cuối**. Khi tạo phiên, đưa một job dọn dẹp vào hàng đợi tại thời điểm hết TTL — job sẽ xóa cứng phiên và refresh token liên kết. BL-45 cron vẫn giữ vai trò quét an toàn. Người dùng có thể xem phiên đang hoạt động qua `GET /auth/sessions` và thu hồi thủ công bất kỳ phiên nào qua `DELETE /auth/sessions/:id`. |
| BL-43 | Bảo vệ brute force | Sau 5 lần đăng nhập thất bại liên tiếp, khóa tài khoản 15 phút. Lưu `failedAttempts` + `lockUntil` trên người dùng. Đặt lại bộ đếm khi thành công. Thông báo người dùng qua email khi bị khóa. |

---

## 4. Quản Lý Nội Dung

### 4.1 Máy Trạng Thái Bài Nhạc

| Trạng thái | Mô tả |
|---|---|
| PENDING | Đã tải lên nhưng chưa được admin xem xét. Không hiển thị với người dùng. |
| APPROVED | Admin đã duyệt. Không có ngày phát hành — trở thành LIVE ngay lập tức. |
| SCHEDULED | Admin đã duyệt với `dropAt` trong tương lai. Trang teaser hiển thị. Âm thanh bị khóa (trả về 423). |
| LIVE | Có thể nghe trực tuyến công khai. Xuất hiện trong duyệt, tìm kiếm, hồ sơ nghệ sĩ và feed người theo dõi. |
| REJECTED | Admin từ chối vĩnh viễn kèm chuỗi lý do. Nghệ sĩ được thông báo qua email. Không thể nộp lại. |
| REUPLOAD_REQUIRED | Admin gắn cờ bài nhạc cần chỉnh sửa (ví dụ: nội dung không phù hợp). Nghệ sĩ được thông báo kèm ghi chú lý do. Nghệ sĩ có thể chỉnh sửa và nộp lại → trạng thái trở về `PENDING` (BL-85). |
| TAKEN_DOWN | Bài LIVE trước đó bị admin gỡ xuống do báo cáo nội dung. Có thể khôi phục về LIVE bởi admin (BL-83). |

### 4.2 Quy Trình Tải Lên & Duyệt

| Mã | Tên | Mô tả |
|---|---|---|
| BL-48 | Hạn chế tải lên | `POST /songs/upload` kiểm tra `user.role IN [ARTIST, ADMIN]`. Nếu vai trò USER, ném FORBIDDEN. Tất cả bài tải lên bất kể vai trò đều có `status=PENDING`. Admin tải lên cũng qua PENDING để duy trì audit trail. |
| BL-37 | Quy trình duyệt bài nhạc | Admin xem xét bài PENDING. Hành động: **Duyệt** → `status=APPROVED` (hoặc `SCHEDULED` nếu có `dropAt`); **Từ chối** → `status=REJECTED` kèm lý do bắt buộc (vĩnh viễn); **Yêu cầu tải lại** → `status=REUPLOAD_REQUIRED` kèm ghi chú bắt buộc (BL-84). Chỉ bài LIVE xuất hiện trong duyệt/tìm kiếm. Thông báo người tải lên qua **thông báo trong app và email** với mọi kết quả (duyệt, từ chối, yêu cầu tải lại). Ghi vào AuditLog (BL-40). |
| BL-44 | Xác thực file khi tải lên | Xác thực MIME type qua magic bytes, áp dụng thời lượng tối đa (20 phút), xóa metadata nhúng. Từ chối các file đổi tên lén lút. Server cũng tạo biến thể `.enc` mã hóa AES-256 để tải xuống ngoại tuyến. |
| BL-39 | Giới hạn tải lên | ARTIST không premium: tối đa 50 bài, 50 MB/file. ARTIST PREMIUM: tối đa 200 bài, 200 MB/file. ADMIN: không giới hạn. Trả về `UPLOAD_LIMIT_EXCEEDED` kèm thống kê sử dụng hiện tại khi vượt. |
| BL-49 | Gợi ý thể loại khi tải lên | Nghệ sĩ có thể thêm `suggestedGenres[]` không có trong danh sách đã xác nhận. Mỗi mục tạo bản ghi `GenreSuggestion` (name, suggestedBy, songId, status=PENDING). Admin xét duyệt trong cùng hàng đợi với bài tải lên. Khi duyệt: thêm vào danh sách xác nhận và gắn thẻ bài nhạc. |

### 4.3 Bộ Đếm & Trường Tính Toán

| Mã | Tên | Mô tả |
|---|---|---|
| BL-09 | Bộ đếm lượt nghe bài nhạc | `POST /songs/:id/play` là nguồn duy nhất tăng `songs.total_plays`. Chỉ tăng khi `secondsPlayed >= 30` (giao dịch nguyên tử). `GET /songs/:id` chỉ đọc — không tăng bộ đếm. Trường `song.listener` cũ đã bị xóa hoàn toàn và thay bằng `total_plays`. |
| BL-10 | Bộ đếm lượt theo dõi album | Mỗi `GET /albums/:id` tăng `album.follower` lên 1. |
| BL-11 | Bộ đếm lượt theo dõi nghệ sĩ | Mỗi `GET /artists/:id` tăng `artist.follower` lên 1. |
| BL-12 | Bộ đếm playlist | Mỗi `GET /playlists/:id` tăng cả `playlist.follower` và `playlist.listener` lên 1. |
| BL-14 | totalTracks & totalHours của album | Tính từ các bài nhạc liên kết. Tính lại khi tạo/cập nhật album và khi thêm/xóa bài. |
| BL-15 | totalTracks & totalHours của playlist | Tương tự BL-14. Tính lại khi tạo/cập nhật playlist và thêm/xóa bài. |

### 4.4 Quy Tắc Cascade & Xóa

| Mã | Tên | Mô tả |
|---|---|---|
| BL-16 | Cascade xóa bài nhạc | Khi xóa: gỡ bài khỏi tất cả playlist. Cập nhật `totalTracks` + `totalHours` album. Thu hồi tất cả DownloadRecord cho bài đó (đặt `revokedAt = now`). |
| BL-17 | Cascade xóa playlist | Khi xóa: gỡ khỏi `savedPlaylists` của tất cả người dùng. Xóa tất cả liên kết playlist-bài nhạc. |
| BL-18 | Cascade xóa album | Khi xóa album: xóa TẤT CẢ bài nhạc trong album đó (kích hoạt BL-16 cho từng bài). |
| BL-19 | Cascade xóa nghệ sĩ | Khi xóa: gỡ nghệ sĩ khỏi danh sách nghệ sĩ của tất cả bài nhạc và album. KHÔNG xóa các bài nhạc hoặc album. |

### 4.5 Chuyển Đổi Trạng Thái Bài Nhạc (Hành Động Admin)

| Mã | Tên | Mô tả |
|---|---|---|
| BL-83 | Khôi phục bài bị gỡ | `PATCH /admin/songs/:id/restore`. Chỉ ADMIN. Bài phải ở trạng thái `TAKEN_DOWN`. Đặt `status=LIVE`. Ghi vào AuditLog (BL-40). Gửi **thông báo trong app và email** đến người tải lên (mẫu 14.7). Trả về `SongResponse`. |
| BL-84 | Yêu cầu tải lại | `PATCH /admin/songs/:id/reupload-required`. Chỉ ADMIN. Bài phải ở trạng thái `PENDING`. Đặt `status=REUPLOAD_REQUIRED`, lưu `reupload_reason` (ghi chú bắt buộc — ví dụ: "âm thanh chứa nội dung không phù hợp tại 1:34"). Thông báo người tải lên qua email (14.6) và thông báo trong app. Ghi vào AuditLog (BL-40). Trả về `SongResponse`. |
| BL-85 | Nộp lại bài nhạc | `PATCH /songs/:id/resubmit`. Vai trò ARTIST hoặc ADMIN, chỉ bài của mình. Bài phải ở trạng thái `REUPLOAD_REQUIRED`. Nghệ sĩ có thể cập nhật `title`, `coverArtUrl`, `genreIds` và thay thế file âm thanh. Đặt `status=PENDING`. Ghi vào AuditLog. Trả về `SongResponse`. |

### 4.6 Playlist & Quyền Sở Hữu

| Mã | Tên | Mô tả |
|---|---|---|
| BL-13 | Lưu playlist | Thêm playlist vào `savedPlaylists` của người dùng (nhiều-nhiều). Tăng `playlist.listener` lên 1. Trả về `PlaylistResponse`. |
| BL-22 | Gán người tạo playlist | Khi tạo: đặt `creator` = người dùng hiện tại từ JWT. Người tạo không thể thay đổi sau khi tạo. |
| BL-50 | Bảo vệ quyền sở hữu | Tất cả endpoint thay đổi dữ liệu trên bài nhạc và album: nếu `user.role == ARTIST`, xác minh `resource.creatorId == currentUser.id`, ném FORBIDDEN nếu không đúng. Admin bỏ qua. USER bị chặn ở cấp route. |

### 4.7 Kiểm Duyệt & Báo Cáo

| Mã | Tên | Mô tả |
|---|---|---|
| BL-38 | Báo cáo nội dung | Bất kỳ người dùng nào cũng có thể báo cáo bài nhạc, playlist hoặc nghệ sĩ (`EXPLICIT`, `COPYRIGHT`, `INAPPROPRIATE`). Tạo bản ghi `ContentReport`. Admin giải quyết: bỏ qua hoặc gỡ xuống (cascade theo BL-16 đến BL-19). |
| BL-40 | Nhật ký kiểm tra | Mỗi hành động của admin ghi một mục `AuditLog` (`adminId`, `action`, `targetType`, `targetId`, `timestamp`, `notes`). Chỉ đọc. Không bao giờ xóa mục nhật ký kiểm tra. |

---

## 5. Phát Lại & Phát Trực Tuyến

| Mã | Tên | Mô tả |
|---|---|---|
| BL-28 | Cấp chất lượng âm thanh | Tiêu chuẩn 128 kbps cho người không premium. Cao 320 kbps cho người dùng PREMIUM. Hạ cấp ở yêu cầu track tiếp theo nếu premium hết hạn giữa phiên. |
| BL-29 | Lịch sử phát lại | `POST /songs/:id/play` body: `{ secondsPlayed: number, skipped?: boolean }`. Trong **một giao dịch nguyên tử**: (1) chèn bản ghi `playback_history(userId, songId, playedAt, skipped)`; (2) nếu `secondsPlayed >= 30` → tăng `songs.total_plays` bằng câu SQL `UPDATE songs SET total_plays = total_plays + 1`; (3) nếu tổng số hàng của người dùng vượt **500** → xóa bản ghi cũ nhất (FIFO theo `playedAt`). Giới hạn 500 hàng/người dùng. Trả về 204 No Content. Client gọi endpoint này một lần khi chuyển bài. |
| BL-30 | Tiếp tục phát lại | Lưu `positionSeconds` cuối cùng theo người dùng theo bài trong bảng `PlaybackState`. Khi mở app, trả về bài nhạc cuối + vị trí cho lời nhắc 'Tiếp tục nghe'. |
| BL-31 | Quản lý hàng đợi | Hàng đợi phát nhạc phía server mỗi người dùng. Endpoint: thêm, xóa, sắp xếp lại, xóa hết. Hỗ trợ chế độ shuffle. Khi đăng xuất: **xóa cứng** toàn bộ hàng đợi của người dùng đó (không xóa mềm — hàng đợi mất vĩnh viễn). Khi đăng nhập lại, hàng đợi bắt đầu trống; hàng đợi mới được tạo tự động khi người dùng bắt đầu phát bài nhạc. |
| BL-51 | Thống kê nghệ sĩ | `GET /artist/me/analytics` — chỉ vai trò ARTIST. Trả về: `total_plays` theo bài (từ `songs.total_plays`), số lượt thích, số người theo dõi, top 5 bài theo `total_plays` trong 30 ngày qua (đọc từ `playback_history WHERE playedAt >= now - 30d`). Admin truy cập bất kỳ nghệ sĩ qua `GET /admin/artists/:id/analytics`. |

---

## 6. Mạng Xã Hội & Khám Phá

| Mã | Tên | Mô tả |
|---|---|---|
| BL-32 | Theo dõi người dùng / nghệ sĩ | `POST /users/:id/follow`. Người dùng đã xác thực theo dõi người dùng hoặc nghệ sĩ khác. Tạo bản ghi `user_follows`. Tăng `followerCount` của người được theo dõi. Theo dõi nghệ sĩ hiện playlist công khai và thông báo drop trong feed. Trả về `FollowStatsResponse`. |
| BL-72 | Hủy theo dõi người dùng / nghệ sĩ | `DELETE /users/:id/follow`. Người dùng đã xác thực hủy theo dõi. Xóa mềm bản ghi `user_follows`. Giảm `followerCount` của người được theo dõi. Trả về `FollowStatsResponse`. |
| BL-73 | Danh sách người theo dõi / đang theo dõi | `GET /users/:id/followers` — danh sách phân trang người dùng đang theo dõi người dùng `:id`. `GET /users/:id/following` — danh sách phân trang người dùng/nghệ sĩ mà người dùng `:id` đang theo dõi. Cả hai đều công khai. Trả về `PaginatedData<UserResponse>`. |
| BL-33 | Feed hoạt động | Tạo feed từ người dùng và nghệ sĩ đang theo dõi. Sự kiện: playlist mới, thích bài, theo dõi nghệ sĩ, `NEW_RELEASE` (drop kích hoạt), `UPCOMING_DROP` (thông báo). Lưu dưới dạng `FeedEvent` (`actorId`, `eventType`, `targetId`, `createdAt`). Trả về phân trang, mới nhất trước. |
| BL-34 | Thích bài nhạc | Người dùng có thể thích/bỏ thích bài nhạc. `LikedSongs` là playlist đặc biệt — **được tạo nguyên tử khi người dùng thích lần đầu tiên**, không phải khi đăng ký. Nếu playlist chưa tồn tại khi ghi nhận lượt thích, tạo playlist trước rồi thêm bài nhạc vào. Trả về `isLiked: boolean` trong `SongResponse`. |
| BL-36 | Hệ thống thể loại | Bài nhạc và playlist có thể loại (nhiều-nhiều). Thể loại xác nhận do admin quản lý (CRUD qua BL-68–71). Nghệ sĩ gợi ý thể loại mới khi tải lên (BL-49). Cung cấp dữ liệu cho bộ máy gợi ý AI. |
| BL-80 | Danh sách thông báo | `GET /notifications` (đã xác thực, phân trang). Trả về thông báo trong app của người dùng hiện tại theo thứ tự `created_at DESC`. Mỗi mục gồm: `id`, `type`, `title`, `body`, `isRead`, `targetId`, `targetType`, `createdAt`. |
| BL-81 | Đánh dấu thông báo đã đọc | `PATCH /notifications/:id/read`. Đã xác thực. Đặt `is_read=true` và `read_at=now`. Người dùng chỉ có thể đánh dấu thông báo của mình. Trả về thông báo đã cập nhật. |
| BL-82 | Số thông báo chưa đọc | `GET /notifications/unread-count`. Đã xác thực. Trả về `{ count: number }` — số thông báo có `is_read=false` của người dùng hiện tại. Dùng để hiển thị huy hiệu trên chuông thông báo trong UI. |
| BL-68 | Tạo thể loại | `POST /genres`. Chỉ ADMIN. Kiểm tra `name` duy nhất (không phân biệt hoa/thường). Tạo bản ghi thể loại đã xác nhận. Trả về `GenreResponse`. |
| BL-69 | Cập nhật thể loại | `PATCH /genres/:id`. Chỉ ADMIN. Cập nhật `name`. Kiểm tra tên mới duy nhất (không phân biệt hoa/thường). Trả về `GenreResponse` đã cập nhật. |
| BL-70 | Xóa thể loại | `DELETE /genres/:id`. Chỉ ADMIN. Xóa mềm thể loại. Các liên kết bài nhạc/playlist hiện có được giữ nguyên nhưng thể loại không còn xuất hiện trong duyệt hoặc danh sách gợi ý. Ghi vào AuditLog (BL-40). |
| BL-71 | Xem danh sách / chi tiết thể loại | `GET /genres` (công khai, phân trang). `GET /genres/:id` (công khai). Chỉ trả về thể loại đã xác nhận (deleted_at IS NULL). |

---

## 7. Gợi Ý Nhạc AI & Phát Thông Minh

> Lưu ý: Các bài `SCHEDULED` bị loại khỏi tất cả bộ máy gợi ý — chỉ các bài `LIVE` mới đủ điều kiện.

### 7.1 Gợi Ý Cá Nhân Hóa

| Mã | Tên | Mô tả |
|---|---|---|
| BL-35 | Gợi ý dựa trên quy tắc | Gợi ý bài LIVE từ thể loại nghe nhiều nhất. Nguồn dữ liệu: bảng `playback_history` (giới hạn 500 hàng, cửa sổ `7d` hoặc `30d`, mặc định `30d`). Fallback sang bài LIVE có `total_plays` cao nhất toàn cầu nếu người dùng có < 5 lượt nghe không bỏ qua trong cửa sổ. Tính lại hàng ngày qua `RecommendationBatchWorker`. |
| BL-35A | Chiến lược cold start & Onboarding | Người dùng mới (< 5 lượt nghe trong `playback_history`) được điều hướng đến `/onboarding` ngay sau khi đăng nhập lần đầu. Flag `onboardingCompleted: boolean` trong `TokenResponse` điều khiển luồng này ở frontend. Trang `/onboarding` có decorator `@SkipEmailVerified()` — người dùng chưa xác minh email vẫn có thể hoàn tất. Hai endpoint: `POST /users/me/onboarding` (ghi `user_genre_preferences`, đặt `onboardingCompleted=true`, chấp nhận `skipped: true`) và `PATCH /users/me/genres` (cập nhật sở thích sau này). Dữ liệu thể loại đã chọn được đưa vào gợi ý ban đầu ngay lập tức. |
| BL-35B | Vòng phản hồi bỏ qua | Tín hiệu bỏ qua ghi qua `PATCH /playback/skip` body `{ songId, positionSeconds }`. Ghi `skipped=true` vào `playback_history`. Các lượt phát có `skipped=true` là tín hiệu tiêu cực — giảm trọng số bài/nghệ sĩ/thể loại trong bộ máy gợi ý. Trọng số bỏ qua giảm dần về trung lập sau 90 ngày. |

### 7.2 Gợi Ý Theo Tâm Trạng

**Ánh xạ tâm trạng:**
- Vui vẻ → Pop/Dance, 120–145 BPM, năng lượng cao
- Buồn → Ballad/Acoustic, 60–90 BPM, năng lượng thấp
- Tập trung → Lo-fi/Ambient, 70–100 BPM, năng lượng vừa
- Thư giãn → R&B/Jazz, 80–110 BPM, năng lượng thấp-vừa
- Tập luyện → EDM/Hip-Hop, 130–175 BPM, năng lượng rất cao

| Mã | Tên | Mô tả |
|---|---|---|
| BL-36A | Chọn tâm trạng trực tiếp | Người dùng chọn tâm trạng. Hệ thống ánh xạ tâm trạng → bộ lọc thể loại/BPM/năng lượng và truy vấn bài LIVE. Trả về dưới dạng playlist tâm trạng. Kết hợp được với BL-35. |
| BL-36B | Suy luận tâm trạng (ngữ cảnh) | Nếu không có tâm trạng rõ ràng: suy luận từ thời gian trong ngày (sáng → tập trung, tối → thư giãn) và ngày trong tuần (cuối tuần → vui vẻ). Fallback sang thể loại hàng đầu nếu độ tin cậy dưới ngưỡng. |

### 7.3 Chuyển Track Thông Minh

| Mã | Tên | Mô tả |
|---|---|---|
| BL-37A | Điểm tương thích | Chấm điểm các cặp liên tiếp dựa trên chênh lệch BPM, khóa Camelot và delta năng lượng (0–100). Lưu dưới dạng metadata bài nhạc khi tải lên. |
| BL-37B | Crossfade | Cấu hình theo người dùng (0–12 giây, mặc định 3s). Server báo hiệu cho client trong phản hồi `NowPlaying`. Client xử lý fade âm thanh. |
| BL-37C | Sắp xếp playlist thông minh | Sắp xếp lại track để tối đa hóa tương thích trung bình dùng greedy nearest-neighbor. Chỉ áp dụng khi người dùng bật 'Smart Order'. |

### 7.4 Gợi Ý Theo Ngữ Cảnh

| Mã | Tên | Mô tả |
|---|---|---|
| BL-38A | Ngữ cảnh thiết bị | Mobile → ưu tiên bài < 4 phút, năng lượng cao hơn. Desktop → không hạn chế. Lọc mềm trên BL-35. |
| BL-38B | Ngữ cảnh thời gian | Sáng 6–10 giờ: tập trung/thư giãn. Chiều: trung lập. Tối 18–22 giờ: thư giãn/vui vẻ. Đêm 22 giờ–2 giờ sáng: lo-fi. |
| BL-38C | Ngữ cảnh địa điểm | Vị trí thô → ngữ cảnh hoạt động. Vị trí không bao giờ lưu trữ — chỉ trong request. Thông báo quyền riêng tư khi cấp quyền lần đầu. |

---

## 8. Premium & Thanh Toán

### Luồng Thanh Toán VNPay

| Mã | Tên | Mô tả |
|---|---|---|
| BL-20 | Khởi tạo thanh toán VNPay | `GET /payment/vn-pay?premiumType=`. Ánh xạ: 1 tháng = 30.000 VND, 3 tháng = 79.000 VND, 6 tháng = 169.000 VND, 12 tháng = 349.000 VND. Tạo tham số VNPay, sắp xếp theo thứ tự bảng chữ cái, ký với HMAC-SHA512. Trả về `paymentUrl`. |
| BL-21 | Callback VNPay | Khi `responseCode == '00'`: tính `premiumExpiryDate`, đặt `premiumStatus=true`, thêm vai trò PREMIUM (không thay thế vai trò hiện có), lưu người dùng, gửi thông báo trong app + email xác nhận. Trả về `PremiumResponse`. |

### Luồng Thanh Toán MoMo

| Mã | Tên | Mô tả |
|---|---|---|
| BL-76 | Khởi tạo thanh toán MoMo | `GET /payment/momo?premiumType=`. Cùng bảng giá với VNPay. Tạo tham số MoMo, ký với HMAC-SHA256. Trả về `paymentUrl` (chuyển hướng MoMo). |
| BL-77 | Callback MoMo | Xác minh chữ ký MoMo: tính lại HMAC-SHA256 trên các tham số callback bằng `accessKey + secretKey`; từ chối với 400 nếu chữ ký không khớp. Khi `resultCode == 0`: tính `premiumExpiryDate`, đặt `premiumStatus=true`, thêm vai trò PREMIUM (không thay thế vai trò hiện có), lưu người dùng, gửi thông báo trong app + email xác nhận. Trả về `PremiumResponse`. |

### Quản Lý Premium Thủ Công (Admin)

| Mã | Tên | Mô tả |
|---|---|---|
| BL-74 | Admin cấp premium | `POST /admin/users/:id/premium`. Chỉ ADMIN. Body: `{ premiumType, reason }`. Tính `premiumExpiryDate` theo cùng thời hạn gói. Đặt `premiumStatus=true`, thêm vai trò PREMIUM. Tạo bản ghi `payment_records` với `status=ADMIN_GRANTED` và `amount_vnd=0`. Ghi vào AuditLog (BL-40). Gửi **thông báo trong app và email** đến người dùng (mẫu 14.2). Trả về `PremiumResponse`. |
| BL-75 | Admin thu hồi premium | `DELETE /admin/users/:id/premium`. Chỉ ADMIN. Body: `{ reason }`. Đặt `premiumStatus=false`, xóa vai trò PREMIUM. Kích hoạt BL-56 (thu hồi tất cả giấy phép tải xuống). Ghi vào AuditLog (BL-40). Gửi **thông báo trong app và email** đến người dùng (mẫu 14.8). Trả về `UserResponse`. |

---

## 9. Tìm Kiếm & Phân Trang

| Mã | Tên | Mô tả |
|---|---|---|
| BL-23 | Tìm kiếm | Định dạng tìm kiếm: mảng chuỗi ví dụ `["name~Rock", "listener>1000"]`. Toán tử: `~` (LIKE), `>` (lớn hơn), `<` (nhỏ hơn). Kết hợp với AND. Xây dựng TypeORM QueryBuilder động. Tìm kiếm chỉ trả về bài LIVE — bài SCHEDULED bị loại trừ. |
| BL-24 | Phân trang | Mặc định: `page=1`, `size=10`, `sortBy='id'`. Tất cả endpoint danh sách trả về: `page`, `size`, `totalPages`, `totalItems`, `items[]`. |

---

## 10. Tác Vụ Lên Lịch

| Mã | Tên | Lịch | Mô tả |
|---|---|---|---|
| BL-25 | Dọn dẹp refresh token | `0 0 * * *` (nửa đêm hàng ngày) | Xóa tất cả bản ghi RefreshToken có `expiryDate < now`. |
| BL-26 | Kiểm tra hết hạn premium | Mỗi giờ | Tìm người dùng có `premiumStatus=true AND premiumExpiryDate < now`. Đặt `premiumStatus=false`. Xóa vai trò PREMIUM. Kích hoạt BL-56 (thu hồi tất cả giấy phép tải xuống). |
| BL-27 | Dọn dẹp mã xác minh | Mỗi giờ | Xóa tất cả bản ghi VerificationCode có `expirationTime < thời gian hiện tại tính bằng phút`. |
| BL-45 | Dọn dẹp phiên không hoạt động | Hàng ngày lúc 2 giờ sáng | Xóa bản ghi Session có `lastSeenAt < 30 ngày trước`. Cũng xóa refresh token liên kết. |
| BL-58 | Dọn dẹp bản ghi tải xuống hết hạn | Hàng ngày lúc 3 giờ sáng | Xóa cứng mục DownloadRecord có `revokedAt < now - 7 ngày`. Không xóa file âm thanh phía server. |
| BL-62 | Cron kích hoạt drop | Mỗi phút (`* * * * *`) | Truy vấn bài `WHERE status=SCHEDULED AND dropAt <= now`. Với mỗi bài: đặt `status=LIVE`, chèn `NEW_RELEASE` FeedEvent cho tất cả người theo dõi nghệ sĩ, đưa vào tìm kiếm/duyệt. Ghi `DROP_FIRED` vào AuditLog. |

---

## 11. Tải Nhạc Ngoại Tuyến

Người dùng PREMIUM có thể tải bài nhạc đã duyệt để nghe ngoại tuyến. File được mã hóa AES-256 phía server. Client giữ JWT bản quyền chứa khóa giải mã đã đóng gói — phát lại cần bản quyền hợp lệ, chưa hết hạn. Người dùng premium đang hoạt động không bao giờ để ý thời hạn 30 ngày vì bản quyền tự gia hạn khi mở app.

### 11.1 Mô Hình Mã Hóa

- Server lưu hai phiên bản file: phiên bản phát trực tuyến (phục vụ nguyên trạng) và phiên bản tải xuống (`.enc`, mã hóa AES-256 với khóa theo bài).
- Khóa AES theo bài được lưu phía server trong kho khóa bảo mật, không bao giờ gửi thô cho client.
- Khi tải xuống, server đóng gói khóa AES với `HMAC(userId + serverSecret)` dành riêng cho người dùng trước khi nhúng vào JWT bản quyền.
- Ngay cả khi JWT bản quyền bị trích xuất từ bộ nhớ thiết bị, nó không thể dùng trên tài khoản khác.

### 11.2 Giới Hạn Quota

| Vai trò | Quota |
|---|---|
| PREMIUM USER | tối đa 100 bài đã tải |
| PREMIUM ARTIST | tối đa 200 bài đã tải |
| ADMIN | không giới hạn |

> Quota được thực thi phía server qua đếm DownloadRecord — không bao giờ tin vào client.

### 11.3 Logic Nghiệp Vụ

| Mã | Tên | Mô tả |
|---|---|---|
| BL-52 | Kiểm tra điều kiện tải xuống | `POST /songs/:id/download` xác thực: người dùng có vai trò PREMIUM, bài `status` là LIVE, `downloadCount` người dùng dưới quota. Trả về `DOWNLOAD_LIMIT_EXCEEDED` hoặc `PREMIUM_REQUIRED` khi thất bại. |
| BL-53 | Cấp giấy phép tải xuống | Khi đạt: lấy khóa AES-256 bài, đóng gói với `HMAC(userId+serverSecret)`, tạo JWT bản quyền `{ songId, userId, encryptedKey, expiresAt: now+30d, version }`. Tạo `DownloadRecord` (`userId`, `songId`, `issuedAt`, `expiresAt`, `revokedAt: null`). Trả về URL tải xuống một lần có ký (TTL 5 phút) + JWT bản quyền. |
| BL-54 | Theo dõi quota tải xuống | `downloadCount = DownloadRecord WHERE userId=X AND revokedAt IS NULL`. Tăng khi tải mới, giảm khi người dùng xóa bài. Thực thi khi kiểm tra BL-52. |
| BL-55 | Gia hạn bản quyền (online) | `POST /songs/downloads/revalidate` — gọi thầm lặng khi mở app và đang online. Với mỗi DownloadRecord đang hoạt động: nếu PREMIUM còn hiệu lực, cấp lại JWT bản quyền mới (đặt lại 30 ngày). Nếu PREMIUM hết hạn, đặt `revokedAt=now` và trả về `revoked: true` để client làm xám bài. |
| BL-56 | Cascade khi mất premium | Khi cron BL-26 hạ cấp người dùng: đặt `revokedAt=now` trên tất cả DownloadRecord của họ. File vẫn ở thiết bị nhưng không phát được ở lần gia hạn tiếp. Bản ghi giữ trong 7 ngày ân hạn phòng trường hợp người dùng gia hạn. Sau 7 ngày, BL-58 xóa cứng. |
| BL-57 | Xóa bài tải thủ công | `DELETE /songs/downloads/:songId` — người dùng xóa bài đã tải. Đặt `DownloadRecord.revokedAt=now`. Trả về `downloadCount` đã cập nhật. Client xóa file `.enc` cục bộ. |

---

## 12. Ra Mắt Trực Tiếp Của Nghệ Sĩ

Nghệ sĩ lên lịch ngày phát hành tương lai cho bài nhạc. Khi ở trạng thái `SCHEDULED`, trang teaser công khai hiển thị tiêu đề, ảnh bìa và bộ đếm ngược trực tiếp — nhưng âm thanh bị khóa hoàn toàn. Đúng giờ phát hành, cron theo phút tự động kích hoạt bản phát hành, đưa vào feed người theo dõi và có thể duyệt, tìm kiếm.

### 12.1 Ràng Buộc Drop

- Cửa sổ drop tối thiểu: **1 giờ** từ thời điểm tải lên.
- Cửa sổ drop tối đa: **90 ngày** từ thời điểm tải lên.
- Ngày drop chỉ có thể đặt khi tải lên hoặc trong quá trình admin duyệt — không sau khi đã SCHEDULED.
- Nghệ sĩ có thể dời lịch **một lần** (BL-65), tối thiểu 24 giờ trước `dropAt` gốc.
- Bài `SCHEDULED` trả về **HTTP 423 Locked** với mọi yêu cầu nghe nhạc — không có ngoại lệ.
- Bài `SCHEDULED` bị loại khỏi tìm kiếm, duyệt và tất cả bộ máy gợi ý AI.

### 12.2 Lịch Thông Báo

| Thời điểm | Sự kiện |
|---|---|
| 24 giờ trước `dropAt` | `UPCOMING_DROP` FeedEvent gửi đến tất cả người theo dõi nghệ sĩ |
| 1 giờ trước `dropAt` | `UPCOMING_DROP` FeedEvent thứ hai được gửi |
| Tại `dropAt` | `NEW_RELEASE` FeedEvent gửi đến người theo dõi + thông báo trong app đến người dùng đã đăng ký (BL-64) |
| Khi hủy | Thông báo `DROP_CANCELLED` đến người dùng đã đăng ký và người theo dõi đã nhận thông báo 24h |

### 12.3 Logic Nghiệp Vụ

| Mã | Tên | Mô tả |
|---|---|---|
| BL-59 | Tải lên drop có lịch | Nghệ sĩ tùy chọn đặt `dropAt` (datetime tương lai, tối thiểu 1h, tối đa 90 ngày). Nếu `dropAt` được đặt và admin duyệt: bài vào `status=SCHEDULED`. Nếu không có `dropAt`: bài được duyệt trở thành LIVE ngay (hành vi hiện tại). |
| BL-60 | Teaser công khai trước drop | `GET /songs/:id/teaser` (công khai, không cần JWT). Trả về: `title`, `coverArt`, `artistName`, `dropAt`, `countdownSeconds`. Trả về 404 nếu PENDING hoặc REJECTED. Mọi endpoint nghe nhạc trả về 423 Locked cho bài SCHEDULED — không có ngoại lệ, kể cả admin. |
| BL-61 | Thông báo drop | Khi bài vào SCHEDULED: đưa vào hàng đợi hai job thông báo — 24h trước và 1h trước `dropAt`. Mỗi job gửi `UPCOMING_DROP` FeedEvent đến tất cả người theo dõi nghệ sĩ. Nếu drop bị hủy trước khi job kích hoạt, hủy cả hai job. |
| BL-62 | Cron kích hoạt drop | Cron: mỗi phút. Truy vấn `WHERE status=SCHEDULED AND dropAt <= now`. Với mỗi bài: đặt `status=LIVE`, chèn `NEW_RELEASE` FeedEvent cho người theo dõi, thêm vào tìm kiếm/duyệt. Ghi `DROP_FIRED` vào AuditLog. Cần index trên `(status, dropAt)`. |
| BL-63 | Hủy drop | Nghệ sĩ hoặc admin: `DELETE /songs/:id/drop`. Đặt `dropAt=null`, hoàn trạng thái `status=APPROVED` (không cần duyệt lại). Hủy các job thông báo đang chờ. Gửi `DROP_CANCELLED` đến người dùng đã đăng ký. |
| BL-64 | Đăng ký nhận thông báo | `POST /songs/:id/notify` (đã xác thực). Tạo bản ghi `DropNotification` (`userId`, `songId`). Khi cron kích hoạt drop, gửi **thông báo trong app** đến tất cả người dùng đã đăng ký ngoài người theo dõi. Thông báo được lưu vào bảng `notifications` và hiển thị trong chuông thông báo / hộp thư đến của người dùng. `DELETE /songs/:id/notify` để hủy đăng ký. |
| BL-65 | Dời lịch drop | `PATCH /songs/:id/drop` — nghệ sĩ cập nhật `dropAt` một lần, tối thiểu 24h trước thời điểm gốc. `dropAt` mới phải ít nhất 1h trong tương lai. Lên lịch lại job thông báo. Gửi `DROP_RESCHEDULED` FeedEvent đến người dùng đã đăng ký và người theo dõi. Lần dời lịch thứ hai cần admin duyệt. |

---

## 13. Yêu Cầu Phi Chức Năng

| Danh mục | Yêu cầu |
|---|---|
| Hiệu suất | Độ trễ API gợi ý AI < 200 ms. API chung p95 < 500 ms. Cron kích hoạt drop hoàn thành trong vòng 30 giây sau `dropAt`. |
| Khả năng mở rộng | Hỗ trợ 20–200 người dùng đồng thời hiện tại. Tầng AI thiết kế để mở rộng đến 1.000+ với refactoring tối thiểu. |
| Quyền riêng tư | Tuân thủ kiểu GDPR. Dữ liệu vị trí (BL-38C) không bao giờ lưu trữ. Khóa AES tải xuống không bao giờ gửi thô cho client. Người dùng có thể yêu cầu xuất dữ liệu đầy đủ và xóa tài khoản. |
| Khả năng quan sát | Ghi log có cấu trúc cho tất cả quyết định gợi ý AI. Thực thi cron được ghi log kèm số hàng. Sự kiện kích hoạt drop được ghi vào AuditLog. Hỗ trợ A/B testing qua feature flags. |
| Khả dụng | Mục tiêu uptime 99,5%. Tác vụ lên lịch không được ảnh hưởng đến thời gian phản hồi API. Lỗi cron drop phải cảnh báo admin. |
| Bảo mật | Chỉ HTTPS. Tất cả endpoint yêu cầu JWT trừ duyệt công khai và trang teaser. Nhật ký kiểm tra bất biến. Bảo vệ brute force trên tất cả endpoint xác thực. JWT bản quyền tải xuống được ký và giới hạn theo người dùng. |
| An toàn tải lên | Tất cả file âm thanh được xác thực phía server qua magic bytes trước khi lưu. Biến thể `.enc` được tạo khi tải lên — không theo yêu cầu. |
| Đánh chỉ mục DB | Index tổng hợp trên `songs(status, dropAt)` cần thiết cho hiệu suất cron drop. Index trên `download_records(userId, revokedAt)` cho kiểm tra quota. |

---

## 14. Mẫu Email Thông Báo

Tất cả email được gửi bất đồng bộ và không được làm chậm phản hồi API.

---

### 14.1 Xác Minh Email (gửi khi BL-01, BL-46, BL-79)

| Trường | Nội dung |
|---|---|
| **Tiêu đề** | Xác minh email của bạn — Music App |
| **Đến** | Email người dùng đăng ký |
| **Nội dung** | Xin chào `{name}`, mã xác minh của bạn là: **`{code}`**. Mã hết hạn sau 10 phút. Nếu bạn không đăng ký, hãy bỏ qua email này. |
| **Hành động** | Người dùng nhập mã trong app → kích hoạt BL-78 |

---

### 14.2 Kích Hoạt Premium (gửi khi BL-21, BL-77, BL-74)

| Trường | Nội dung |
|---|---|
| **Tiêu đề** | Premium đã được kích hoạt — Chào mừng đến Music App Premium! |
| **Đến** | Email người dùng |
| **Nội dung** | Xin chào `{name}`, gói Premium của bạn đã được kích hoạt thành công. **Gói:** `{premiumType}` · **Hết hạn:** `{premiumExpiryDate}` · **Số tiền thanh toán:** `{amountVnd}` VND. Bạn hiện có quyền truy cập âm thanh 320 kbps, tải nhạc ngoại tuyến (tối đa 100 bài) và giới hạn tải lên cao hơn. Chúc bạn nghe nhạc vui vẻ! |
| **Lưu ý** | Nếu được Admin cấp (BL-74), `Số tiền thanh toán` hiển thị "Miễn phí" và `Gói` hiển thị cấp được cấp. |

---

### 14.3 Cảnh Báo Hết Hạn Premium (cron tương lai — chưa có BL)

> Chưa triển khai. Đề xuất: gửi email cảnh báo 3 ngày trước `premiumExpiryDate`. Thêm BL cron mới khi sẵn sàng.

---

### 14.4 Duyệt / Từ Chối Bài Nhạc (gửi khi BL-37)

| Trường | Nội dung |
|---|---|
| **Tiêu đề (duyệt)** | Bài nhạc của bạn đã được duyệt — Music App |
| **Tiêu đề (từ chối)** | Bài nhạc của bạn chưa được duyệt — Music App |
| **Đến** | Email người tải lên |
| **Nội dung (duyệt)** | Xin chào `{name}`, bài nhạc **"`{songTitle}`"** của bạn đã được duyệt và hiện đang LIVE trên nền tảng. |
| **Nội dung (từ chối)** | Xin chào `{name}`, bài nhạc **"`{songTitle}`"** của bạn chưa được duyệt. Lý do: `{reason}`. Bạn có thể chỉnh sửa và tải lại. |

---

### 14.5 Khóa Tài Khoản (gửi khi BL-43)

| Trường | Nội dung |
|---|---|
| **Tiêu đề** | Tài khoản của bạn đã bị khóa tạm thời — Music App |
| **Đến** | Email người dùng |
| **Nội dung** | Xin chào `{name}`, tài khoản của bạn đã bị khóa 15 phút do đăng nhập sai 5 lần liên tiếp. Nếu không phải bạn, hãy đặt lại mật khẩu. |

---

## 15. Chỉ Mục Tham Chiếu Logic Nghiệp Vụ

Tất cả mã BL theo thứ tự số. Tổng cộng: **85 mã**.

| Mã | Tên | Mục |
|---|---|---|
| BL-01 | Đăng ký người dùng | 3. Xác thực |
| BL-02 | Đăng nhập | 3. Xác thực |
| BL-03 | Đăng xuất | 3. Xác thực |
| BL-04 | Làm mới token | 3. Xác thực |
| BL-05 | Đổi mật khẩu | 3. Xác thực |
| BL-06 | Quên mật khẩu | 3. Xác thực |
| BL-07 | Xác minh mã | 3. Xác thực |
| BL-08 | Đặt lại mật khẩu | 3. Xác thực |
| BL-09 | Bộ đếm lượt nghe bài nhạc | 4. Quản lý nội dung |
| BL-10 | Bộ đếm lượt theo dõi album | 4. Quản lý nội dung |
| BL-11 | Bộ đếm lượt theo dõi nghệ sĩ | 4. Quản lý nội dung |
| BL-12 | Bộ đếm playlist | 4. Quản lý nội dung |
| BL-13 | Lưu playlist | 4. Quản lý nội dung |
| BL-14 | totalTracks & totalHours album | 4. Quản lý nội dung |
| BL-15 | totalTracks & totalHours playlist | 4. Quản lý nội dung |
| BL-16 | Cascade xóa bài nhạc | 4. Quản lý nội dung |
| BL-17 | Cascade xóa playlist | 4. Quản lý nội dung |
| BL-18 | Cascade xóa album | 4. Quản lý nội dung |
| BL-19 | Cascade xóa nghệ sĩ | 4. Quản lý nội dung |
| BL-20 | Khởi tạo thanh toán VNPay | 8. Premium & Thanh toán |
| BL-21 | Callback VNPay | 8. Premium & Thanh toán |
| BL-22 | Gán người tạo playlist | 4. Quản lý nội dung |
| BL-23 | Tìm kiếm | 9. Tìm kiếm & Phân trang |
| BL-24 | Phân trang | 9. Tìm kiếm & Phân trang |
| BL-25 | Dọn dẹp refresh token (cron) | 10. Tác vụ lên lịch |
| BL-26 | Kiểm tra hết hạn premium (cron) | 10. Tác vụ lên lịch |
| BL-27 | Dọn dẹp mã xác minh (cron) | 10. Tác vụ lên lịch |
| BL-28 | Cấp chất lượng âm thanh | 5. Phát lại & Phát trực tuyến |
| BL-29 | Lịch sử phát lại | 5. Phát lại & Phát trực tuyến |
| BL-30 | Tiếp tục phát lại | 5. Phát lại & Phát trực tuyến |
| BL-31 | Quản lý hàng đợi | 5. Phát lại & Phát trực tuyến |
| BL-32 | Hệ thống theo dõi | 6. Mạng xã hội & Khám phá |
| BL-33 | Feed hoạt động | 6. Mạng xã hội & Khám phá |
| BL-34 | Thích bài nhạc | 6. Mạng xã hội & Khám phá |
| BL-35 | Gợi ý dựa trên quy tắc | 7. Gợi ý AI |
| BL-35A | Chiến lược cold start | 7. Gợi ý AI |
| BL-35B | Vòng phản hồi bỏ qua | 7. Gợi ý AI |
| BL-36 | Hệ thống thể loại | 6. Mạng xã hội & Khám phá |
| BL-36A | Chọn tâm trạng trực tiếp | 7. Gợi ý AI |
| BL-36B | Suy luận tâm trạng (ngữ cảnh) | 7. Gợi ý AI |
| BL-37 | Quy trình duyệt bài nhạc | 4. Quản lý nội dung |
| BL-37A | Điểm tương thích track | 7. Gợi ý AI |
| BL-37B | Crossfade | 7. Gợi ý AI |
| BL-37C | Sắp xếp playlist thông minh | 7. Gợi ý AI |
| BL-38 | Báo cáo nội dung | 4. Quản lý nội dung |
| BL-38A | Ngữ cảnh thiết bị | 7. Gợi ý AI |
| BL-38B | Ngữ cảnh thời gian | 7. Gợi ý AI |
| BL-38C | Ngữ cảnh địa điểm (tùy chọn) | 7. Gợi ý AI |
| BL-39 | Giới hạn tải lên | 4. Quản lý nội dung |
| BL-40 | Nhật ký kiểm tra | 4. Quản lý nội dung |
| BL-41 | Giới hạn tốc độ | 3. Xác thực |
| BL-42 | Quản lý phiên thiết bị | 3. Xác thực |
| BL-43 | Bảo vệ brute force | 3. Xác thực |
| BL-44 | Xác thực file khi tải lên | 4. Quản lý nội dung |
| BL-45 | Dọn dẹp phiên không hoạt động (cron) | 10. Tác vụ lên lịch |
| BL-46 | Đăng ký nghệ sĩ | 3. Xác thực |
| BL-47 | Bản ghi hồ sơ nghệ sĩ | 3. Xác thực |
| BL-48 | Hạn chế tải lên | 4. Quản lý nội dung |
| BL-49 | Gợi ý thể loại khi tải lên | 4. Quản lý nội dung |
| BL-50 | Bảo vệ quyền sở hữu | 4. Quản lý nội dung |
| BL-51 | Thống kê nghệ sĩ | 5. Phát lại & Phát trực tuyến |
| BL-52 | Kiểm tra điều kiện tải xuống | 11. Tải ngoại tuyến |
| BL-53 | Cấp giấy phép tải xuống | 11. Tải ngoại tuyến |
| BL-54 | Theo dõi quota tải xuống | 11. Tải ngoại tuyến |
| BL-55 | Gia hạn bản quyền (online) | 11. Tải ngoại tuyến |
| BL-56 | Cascade khi mất premium | 11. Tải ngoại tuyến |
| BL-57 | Xóa bài tải thủ công | 11. Tải ngoại tuyến |
| BL-58 | Dọn dẹp bản ghi tải xuống hết hạn (cron) | 10. Tác vụ lên lịch |
| BL-59 | Tải lên drop có lịch | 12. Ra mắt trực tiếp |
| BL-60 | Teaser công khai trước drop | 12. Ra mắt trực tiếp |
| BL-61 | Thông báo drop | 12. Ra mắt trực tiếp |
| BL-62 | Cron kích hoạt drop | 10. Tác vụ lên lịch |
| BL-63 | Hủy drop | 12. Ra mắt trực tiếp |
| BL-64 | Đăng ký nhận thông báo | 12. Ra mắt trực tiếp |
| BL-65 | Dời lịch drop | 12. Ra mắt trực tiếp |
| BL-66 | Cập nhật hồ sơ người dùng | 3. Xác thực |
| BL-67 | Cập nhật hồ sơ nghệ sĩ | 3. Xác thực |
| BL-68 | Tạo thể loại | 6. Mạng xã hội & Khám phá |
| BL-69 | Cập nhật thể loại | 6. Mạng xã hội & Khám phá |
| BL-70 | Xóa thể loại | 6. Mạng xã hội & Khám phá |
| BL-71 | Xem danh sách / chi tiết thể loại | 6. Mạng xã hội & Khám phá |
| BL-72 | Hủy theo dõi người dùng / nghệ sĩ | 6. Mạng xã hội & Khám phá |
| BL-73 | Danh sách người theo dõi / đang theo dõi | 6. Mạng xã hội & Khám phá |
| BL-74 | Admin cấp premium | 8. Premium & Thanh toán |
| BL-75 | Admin thu hồi premium | 8. Premium & Thanh toán |
| BL-76 | Khởi tạo thanh toán MoMo | 8. Premium & Thanh toán |
| BL-77 | Callback MoMo | 8. Premium & Thanh toán |
| BL-78 | Xác minh email | 3. Xác thực |
| BL-79 | Gửi lại email xác minh | 3. Xác thực |
| BL-80 | Danh sách thông báo | 6. Mạng xã hội & Khám phá |
| BL-81 | Đánh dấu thông báo đã đọc | 6. Mạng xã hội & Khám phá |
| BL-82 | Số thông báo chưa đọc | 6. Mạng xã hội & Khám phá |
| BL-83 | Khôi phục bài bị gỡ | 4. Quản lý nội dung |
| BL-84 | Yêu cầu tải lại | 4. Quản lý nội dung |
| BL-85 | Nộp lại bài nhạc | 4. Quản lý nội dung |
