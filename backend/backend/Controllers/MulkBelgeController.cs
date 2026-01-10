using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using EmlakYonetimAPI.DbHelper;
using EmlakYonetimAPI.Models;
using System.IO;

namespace EmlakYonetimAPI.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class MulkBelgeController : ControllerBase
    {
        private readonly IWebHostEnvironment _environment;
        private readonly string _uploadPath;

        public MulkBelgeController(IWebHostEnvironment environment)
        {
            _environment = environment;
            _uploadPath = Path.Combine(_environment.ContentRootPath, "wwwroot", "uploads", "belgeler");
            
            // Klasör yoksa oluştur
            if (!Directory.Exists(_uploadPath))
            {
                Directory.CreateDirectory(_uploadPath);
            }
        }
        // 1️⃣ MÜLK BELGELERİNİ GETİR
        [HttpGet("mulk/{mulkId}")]
        public async Task<ActionResult<IEnumerable<object>>> GetByMulk(int mulkId)
        {
            var list = new List<object>();

            using var conn = Connection.GetConnection();
            await conn.OpenAsync();

            string sql = @"
                SELECT 
                    MB.MulkBelgeID, MB.MulkID, MB.BelgeTuru, MB.DosyaYolu, 
                    MB.Aciklama, MB.YuklemeTarihi
                FROM MulkBelge MB
                WHERE MB.MulkID = @mulkId
                ORDER BY MB.YuklemeTarihi DESC";

            using var cmd = new SqlCommand(sql, conn);
            cmd.Parameters.AddWithValue("@mulkId", mulkId);

            using var reader = await cmd.ExecuteReaderAsync();

            while (await reader.ReadAsync())
            {
                list.Add(new
                {
                    MulkBelgeID = Convert.ToInt32(reader["MulkBelgeID"]),
                    MulkID = Convert.ToInt32(reader["MulkID"]),
                    BelgeTuru = reader["BelgeTuru"].ToString(),
                    DosyaYolu = reader["DosyaYolu"].ToString(),
                    Aciklama = reader["Aciklama"] == DBNull.Value ? null : reader["Aciklama"].ToString(),
                    YuklemeTarihi = Convert.ToDateTime(reader["YuklemeTarihi"]).ToString("dd.MM.yyyy HH:mm")
                });
            }

            return Ok(list);
        }

        // 2️⃣ BELGE EKLE (Dosya Yükleme)
        [HttpPost("upload")]
        public async Task<ActionResult> UploadDocument([FromForm] int mulkID, [FromForm] string belgeTuru, [FromForm] string? aciklama, IFormFile? file)
        {
            // Dosya kontrolü
            if (file == null || file.Length == 0)
                return BadRequest("Dosya seçilmedi.");

            if (string.IsNullOrWhiteSpace(belgeTuru))
                return BadRequest("Belge türü zorunludur.");

            // Dosya tipi kontrolü (PDF, DOC, DOCX, XLS, XLSX, JPG, PNG)
            var allowedExtensions = new[] { ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".jpg", ".jpeg", ".png" };
            var fileExtension = Path.GetExtension(file.FileName).ToLowerInvariant();
            if (!allowedExtensions.Contains(fileExtension))
                return BadRequest("Desteklenmeyen dosya formatı. PDF, DOC, DOCX, XLS, XLSX, JPG, PNG formatları kabul edilir.");

            // Dosya boyutu kontrolü (max 20MB)
            if (file.Length > 20 * 1024 * 1024)
                return BadRequest("Dosya boyutu 20MB'dan küçük olmalıdır.");

            using var conn = Connection.GetConnection();
            await conn.OpenAsync();

            // Mülk kontrolü
            string checkSql = "SELECT COUNT(1) FROM Mulk WHERE MulkID = @id";
            using var checkCmd = new SqlCommand(checkSql, conn);
            checkCmd.Parameters.AddWithValue("@id", mulkID);
            if ((int)await checkCmd.ExecuteScalarAsync() == 0)
                return BadRequest("Geçersiz Mülk ID.");

            // Benzersiz dosya adı oluştur
            var fileName = $"{Guid.NewGuid()}{fileExtension}";
            var filePath = Path.Combine(_uploadPath, fileName);

            // Dosyayı kaydet
            using (var stream = new FileStream(filePath, FileMode.Create))
            {
                await file.CopyToAsync(stream);
            }

            // Veritabanına kaydet
            var relativePath = $"/uploads/belgeler/{fileName}";
            string sql = @"
                INSERT INTO MulkBelge (MulkID, BelgeTuru, DosyaYolu, Aciklama, YuklemeTarihi)
                OUTPUT INSERTED.MulkBelgeID
                VALUES (@MulkID, @BelgeTuru, @DosyaYolu, @Aciklama, GETDATE())";

            using var cmd = new SqlCommand(sql, conn);
            cmd.Parameters.AddWithValue("@MulkID", mulkID);
            cmd.Parameters.AddWithValue("@BelgeTuru", belgeTuru);
            cmd.Parameters.AddWithValue("@DosyaYolu", relativePath);
            cmd.Parameters.AddWithValue("@Aciklama", (object?)aciklama ?? DBNull.Value);

            int newId = (int)await cmd.ExecuteScalarAsync();
            return Ok(new { Message = "Belge eklendi.", MulkBelgeID = newId, DosyaYolu = relativePath });
        }

        // 2️⃣ BELGE EKLE (URL - Eski yöntem, geriye dönük uyumluluk için)
        [HttpPost]
        public async Task<ActionResult> Create([FromBody] MulkBelge model)
        {
            if (model == null || string.IsNullOrWhiteSpace(model.DosyaYolu))
                return BadRequest("Dosya yolu zorunludur.");

            if (string.IsNullOrWhiteSpace(model.BelgeTuru))
                return BadRequest("Belge türü zorunludur.");

            using var conn = Connection.GetConnection();
            await conn.OpenAsync();

            // Mülk kontrolü
            string checkSql = "SELECT COUNT(1) FROM Mulk WHERE MulkID = @id";
            using var checkCmd = new SqlCommand(checkSql, conn);
            checkCmd.Parameters.AddWithValue("@id", model.MulkID);
            if ((int)await checkCmd.ExecuteScalarAsync() == 0)
                return BadRequest("Geçersiz Mülk ID.");

            string sql = @"
                INSERT INTO MulkBelge (MulkID, BelgeTuru, DosyaYolu, Aciklama, YuklemeTarihi)
                OUTPUT INSERTED.MulkBelgeID
                VALUES (@MulkID, @BelgeTuru, @DosyaYolu, @Aciklama, GETDATE())";

            using var cmd = new SqlCommand(sql, conn);
            cmd.Parameters.AddWithValue("@MulkID", model.MulkID);
            cmd.Parameters.AddWithValue("@BelgeTuru", model.BelgeTuru);
            cmd.Parameters.AddWithValue("@DosyaYolu", model.DosyaYolu);
            cmd.Parameters.AddWithValue("@Aciklama", (object?)model.Aciklama ?? DBNull.Value);

            int newId = (int)await cmd.ExecuteScalarAsync();
            return Ok(new { Message = "Belge eklendi.", MulkBelgeID = newId });
        }

        // 3️⃣ BELGE SİL (Dosya Silme ile)
        [HttpDelete("{id}")]
        public async Task<ActionResult> Delete(int id)
        {
            string? filePath = null;
            
            using (var conn = Connection.GetConnection())
            {
                await conn.OpenAsync();

                // Önce dosya yolunu al
                string getPathSql = "SELECT DosyaYolu FROM MulkBelge WHERE MulkBelgeID = @id";
                using (var getCmd = new SqlCommand(getPathSql, conn))
                {
                    getCmd.Parameters.AddWithValue("@id", id);
                    var result = await getCmd.ExecuteScalarAsync();
                    if (result != null && result != DBNull.Value)
                    {
                        filePath = result.ToString();
                    }
                }

                // Veritabanından sil
                string sql = "DELETE FROM MulkBelge WHERE MulkBelgeID = @id";
                using var cmd = new SqlCommand(sql, conn);
                cmd.Parameters.AddWithValue("@id", id);

                int affected = await cmd.ExecuteNonQueryAsync();
                if (affected == 0) return NotFound("Belge bulunamadı.");
            }

            // Dosyayı da sil (eğer uploads klasöründeyse) - Connection kapandıktan sonra
            if (!string.IsNullOrEmpty(filePath))
            {
                try
                {
                    // Hem /uploads/ hem de uploads/ formatlarını kontrol et
                    string normalizedPath = filePath.TrimStart('/');
                    if (normalizedPath.StartsWith("uploads/"))
                    {
                        var physicalPath = Path.Combine(_environment.ContentRootPath, "wwwroot", normalizedPath);
                        if (System.IO.File.Exists(physicalPath))
                        {
                            System.IO.File.Delete(physicalPath);
                        }
                    }
                }
                catch (Exception ex)
                {
                    // Dosya silme hatası kritik değil, ama loglanabilir
                    // Hata olsa bile veritabanından silindiği için işlem başarılı sayılır
                }
            }

            return Ok(new { Message = "Belge silindi." });
        }
    }
}

