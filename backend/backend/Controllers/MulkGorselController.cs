using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using EmlakYonetimAPI.DbHelper;
using EmlakYonetimAPI.Models;
using System.IO;

namespace EmlakYonetimAPI.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class MulkGorselController : ControllerBase
    {
        private readonly IWebHostEnvironment _environment;
        private readonly string _uploadPath;

        public MulkGorselController(IWebHostEnvironment environment)
        {
            _environment = environment;
            _uploadPath = Path.Combine(_environment.ContentRootPath, "wwwroot", "uploads", "gorseller");
            
            // Klasör yoksa oluştur
            if (!Directory.Exists(_uploadPath))
            {
                Directory.CreateDirectory(_uploadPath);
            }
        }
        // 1️⃣ MÜLK GÖRSELLERİNİ GETİR
        [HttpGet("mulk/{mulkId}")]
        public async Task<ActionResult<IEnumerable<object>>> GetByMulk(int mulkId)
        {
            var list = new List<object>();

            using var conn = Connection.GetConnection();
            await conn.OpenAsync();

            string sql = @"
                SELECT 
                    MG.MulkGorselID, MG.MulkID, MG.DosyaYolu, MG.Aciklama, 
                    MG.YuklemeTarihi, MG.AktifMi
                FROM MulkGorsel MG
                WHERE MG.MulkID = @mulkId AND MG.AktifMi = 1
                ORDER BY MG.YuklemeTarihi DESC";

            using var cmd = new SqlCommand(sql, conn);
            cmd.Parameters.AddWithValue("@mulkId", mulkId);

            using var reader = await cmd.ExecuteReaderAsync();

            while (await reader.ReadAsync())
            {
                list.Add(new
                {
                    MulkGorselID = Convert.ToInt32(reader["MulkGorselID"]),
                    MulkID = Convert.ToInt32(reader["MulkID"]),
                    DosyaYolu = reader["DosyaYolu"].ToString(),
                    Aciklama = reader["Aciklama"] == DBNull.Value ? null : reader["Aciklama"].ToString(),
                    YuklemeTarihi = Convert.ToDateTime(reader["YuklemeTarihi"]).ToString("dd.MM.yyyy HH:mm"),
                    AktifMi = Convert.ToBoolean(reader["AktifMi"])
                });
            }

            return Ok(list);
        }

        // 2️⃣ GÖRSEL EKLE (Dosya Yükleme)
        [HttpPost("upload")]
        public async Task<ActionResult> UploadImage([FromForm] int mulkID, [FromForm] string? aciklama, IFormFile? file)
        {
            // Dosya kontrolü
            if (file == null || file.Length == 0)
                return BadRequest("Dosya seçilmedi.");

            // Dosya tipi kontrolü (sadece resim)
            var allowedExtensions = new[] { ".jpg", ".jpeg", ".png", ".gif", ".webp" };
            var fileExtension = Path.GetExtension(file.FileName).ToLowerInvariant();
            if (!allowedExtensions.Contains(fileExtension))
                return BadRequest("Sadece resim dosyaları yüklenebilir (JPG, PNG, GIF, WEBP).");

            // Dosya boyutu kontrolü (max 10MB)
            if (file.Length > 10 * 1024 * 1024)
                return BadRequest("Dosya boyutu 10MB'dan küçük olmalıdır.");

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
            var relativePath = $"/uploads/gorseller/{fileName}";
            string sql = @"
                INSERT INTO MulkGorsel (MulkID, DosyaYolu, Aciklama, YuklemeTarihi, AktifMi)
                OUTPUT INSERTED.MulkGorselID
                VALUES (@MulkID, @DosyaYolu, @Aciklama, GETDATE(), 1)";

            using var cmd = new SqlCommand(sql, conn);
            cmd.Parameters.AddWithValue("@MulkID", mulkID);
            cmd.Parameters.AddWithValue("@DosyaYolu", relativePath);
            cmd.Parameters.AddWithValue("@Aciklama", (object?)aciklama ?? DBNull.Value);

            int newId = (int)await cmd.ExecuteScalarAsync();
            return Ok(new { Message = "Görsel eklendi.", MulkGorselID = newId, DosyaYolu = relativePath });
        }

        // 2️⃣ GÖRSEL EKLE (URL - Eski yöntem, geriye dönük uyumluluk için)
        [HttpPost]
        public async Task<ActionResult> Create([FromBody] MulkGorsel model)
        {
            if (model == null || string.IsNullOrWhiteSpace(model.DosyaYolu))
                return BadRequest("Dosya yolu zorunludur.");

            using var conn = Connection.GetConnection();
            await conn.OpenAsync();

            // Mülk kontrolü
            string checkSql = "SELECT COUNT(1) FROM Mulk WHERE MulkID = @id";
            using var checkCmd = new SqlCommand(checkSql, conn);
            checkCmd.Parameters.AddWithValue("@id", model.MulkID);
            if ((int)await checkCmd.ExecuteScalarAsync() == 0)
                return BadRequest("Geçersiz Mülk ID.");

            string sql = @"
                INSERT INTO MulkGorsel (MulkID, DosyaYolu, Aciklama, YuklemeTarihi, AktifMi)
                OUTPUT INSERTED.MulkGorselID
                VALUES (@MulkID, @DosyaYolu, @Aciklama, GETDATE(), 1)";

            using var cmd = new SqlCommand(sql, conn);
            cmd.Parameters.AddWithValue("@MulkID", model.MulkID);
            cmd.Parameters.AddWithValue("@DosyaYolu", model.DosyaYolu);
            cmd.Parameters.AddWithValue("@Aciklama", (object?)model.Aciklama ?? DBNull.Value);

            int newId = (int)await cmd.ExecuteScalarAsync();
            return Ok(new { Message = "Görsel eklendi.", MulkGorselID = newId });
        }

        // 3️⃣ GÖRSEL SİL (Soft Delete + Dosya Silme)
        [HttpDelete("{id}")]
        public async Task<ActionResult> Delete(int id)
        {
            string? filePath = null;
            
            using (var conn = Connection.GetConnection())
            {
                await conn.OpenAsync();

                // Önce dosya yolunu al
                string getPathSql = "SELECT DosyaYolu FROM MulkGorsel WHERE MulkGorselID = @id";
                using (var getCmd = new SqlCommand(getPathSql, conn))
                {
                    getCmd.Parameters.AddWithValue("@id", id);
                    var result = await getCmd.ExecuteScalarAsync();
                    if (result != null && result != DBNull.Value)
                    {
                        filePath = result.ToString();
                    }
                }

                // Veritabanından sil (soft delete)
                string sql = "UPDATE MulkGorsel SET AktifMi = 0 WHERE MulkGorselID = @id";
                using var cmd = new SqlCommand(sql, conn);
                cmd.Parameters.AddWithValue("@id", id);

                int affected = await cmd.ExecuteNonQueryAsync();
                if (affected == 0) return NotFound("Görsel bulunamadı.");
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

            return Ok(new { Message = "Görsel silindi." });
        }
    }
}

