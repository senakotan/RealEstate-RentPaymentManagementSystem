using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using EmlakYonetimAPI.DbHelper;
using EmlakYonetimAPI.Models;

namespace EmlakYonetimAPI.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class RegisterController : ControllerBase
    {
        [HttpPost]
        public async Task<ActionResult> Register(RegisterRequest request)
        {
            if (!ModelState.IsValid) return BadRequest("Eksik bilgi.");

            using var conn = Connection.GetConnection();
            await conn.OpenAsync();

            // 1. Email Kontrolü
            string checkSql = "SELECT COUNT(*) FROM Kullanici WHERE Email = @Email";
            using (var checkCmd = new SqlCommand(checkSql, conn))
            {
                checkCmd.Parameters.AddWithValue("@Email", request.Email);
                if ((int)await checkCmd.ExecuteScalarAsync() > 0)
                    return BadRequest("Bu email adresi zaten kayıtlı.");
            }

            // 2. Kullanıcı Ekleme (Şifre şifrelenmeden kaydediliyor)
            string insertSql = @"
                INSERT INTO Kullanici (AdSoyad, Email, SifreHash, Telefon, TCNo, AktifMi, KayitTarihi)
                OUTPUT INSERTED.KullaniciID
                VALUES (@Ad, @Email, @Sifre, @Tel, @TC, 1, GETDATE())";

            int userId;
            using (var cmd = new SqlCommand(insertSql, conn))
            {
                cmd.Parameters.AddWithValue("@Ad", request.AdSoyad);
                cmd.Parameters.AddWithValue("@Email", request.Email);
                cmd.Parameters.AddWithValue("@Sifre", request.Sifre); // Plain Text
                cmd.Parameters.AddWithValue("@Tel", (object?)request.Telefon ?? DBNull.Value);
                cmd.Parameters.AddWithValue("@TC", (object?)request.TCNo ?? DBNull.Value);
                userId = (int)await cmd.ExecuteScalarAsync();
            }

            // 3. Rol Atama (Varsayılan: Owner veya Gelen Rol)
            string rolAdi = string.IsNullOrWhiteSpace(request.RolAdi) ? "Owner" : request.RolAdi;

            // Rol ID'sini bul
            int? rolId = null;
            using (var roleCmd = new SqlCommand("SELECT RolID FROM Rol WHERE RolAdi = @Rol", conn))
            {
                roleCmd.Parameters.AddWithValue("@Rol", rolAdi);
                var result = await roleCmd.ExecuteScalarAsync();
                if (result != null) rolId = (int)result;
            }

            if (rolId.HasValue)
            {
                string assignSql = "INSERT INTO KullaniciRol (KullaniciID, RolID, AtamaTarihi) VALUES (@Uid, @Rid, GETDATE())";
                using (var assignCmd = new SqlCommand(assignSql, conn))
                {
                    assignCmd.Parameters.AddWithValue("@Uid", userId);
                    assignCmd.Parameters.AddWithValue("@Rid", rolId);
                    await assignCmd.ExecuteNonQueryAsync();
                }
            }

            // 4. Log Kaydı
            try
            {
                string logSql = "INSERT INTO Logkayit (KullaniciID, IslemTarihi, IslemTuru, TabloAdi, KayitID, Detay) VALUES (@uid, GETDATE(), 'REGISTER', 'Kullanici', @kid, @detay)";
                using var logCmd = new SqlCommand(logSql, conn);
                logCmd.Parameters.AddWithValue("@uid", userId);
                logCmd.Parameters.AddWithValue("@kid", userId.ToString());
                logCmd.Parameters.AddWithValue("@detay", $"{request.Email} sisteme kayıt oldu.");
                await logCmd.ExecuteNonQueryAsync();
            }
            catch { }

            return Ok(new { Message = "Kayıt başarılı", KullaniciID = userId });
        }
    }
}