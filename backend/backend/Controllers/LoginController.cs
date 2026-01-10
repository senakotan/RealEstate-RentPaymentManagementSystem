using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using EmlakYonetimAPI.DbHelper;
using EmlakYonetimAPI.Models;

namespace EmlakYonetimAPI.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class LoginController : ControllerBase
    {
        [HttpPost]
        public async Task<ActionResult> Login(LoginRequest request)
        {
            if (request == null || string.IsNullOrWhiteSpace(request.Email) || string.IsNullOrWhiteSpace(request.Sifre))
                return BadRequest("Email ve þifre zorunludur.");

            using var conn = Connection.GetConnection();
            await conn.OpenAsync();

            // Þifre hashlenmeden direkt kontrol ediliyor
            var sql = @"
                SELECT K.KullaniciID, K.AdSoyad, K.Email, K.Telefon, K.TCNo, K.AktifMi, K.KayitTarihi, R.RolAdi
                FROM Kullanici K
                LEFT JOIN KullaniciRol KR ON K.KullaniciID = KR.KullaniciID
                LEFT JOIN Rol R ON KR.RolID = R.RolID
                WHERE K.Email=@Email AND K.SifreHash=@Sifre AND K.AktifMi=1";

            using var cmd = new SqlCommand(sql, conn);
            cmd.Parameters.AddWithValue("@Email", request.Email);
            cmd.Parameters.AddWithValue("@Sifre", request.Sifre);

            using var reader = await cmd.ExecuteReaderAsync();

            if (await reader.ReadAsync())
            {
                var user = new
                {
                    KullaniciID = reader.GetInt32(0),
                    AdSoyad = reader.GetString(1),
                    Email = reader.GetString(2),
                    Telefon = reader.IsDBNull(3) ? null : reader.GetString(3),
                    TCNo = reader.IsDBNull(4) ? null : reader.GetString(4),
                    AktifMi = reader.GetBoolean(5),
                    KayitTarihi = reader.GetDateTime(6),
                    Rol = reader.IsDBNull(7) ? "User" : reader.GetString(7)
                };

                return Ok(new { Message = "Giriþ baþarýlý", User = user });
            }

            return Unauthorized("Email veya þifre hatalý!");
        }
    }
}