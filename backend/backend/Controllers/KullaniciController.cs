using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using EmlakYonetimAPI.DbHelper;
using EmlakYonetimAPI.Models;

namespace EmlakYonetimAPI.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class KullaniciController : ControllerBase
    {
        // 1?? LÝSTELEME
        [HttpGet]
        public async Task<ActionResult> GetAll()
        {
            var list = new List<Kullanici>();
            using var conn = Connection.GetConnection();
            await conn.OpenAsync();

            string sql = "SELECT * FROM Kullanici";
            using var cmd = new SqlCommand(sql, conn);
            using var reader = await cmd.ExecuteReaderAsync();

            while (await reader.ReadAsync())
            {
                list.Add(new Kullanici
                {
                    KullaniciID = reader.GetInt32(0),
                    AdSoyad = reader.GetString(1),
                    Email = reader.GetString(2),
                    SifreHash = reader.GetString(3),
                    Telefon = reader.IsDBNull(4) ? null : reader.GetString(4),
                    TCNo = reader.IsDBNull(5) ? null : reader.GetString(5),
                    AktifMi = reader.GetBoolean(6),
                    KayitTarihi = reader.GetDateTime(7)
                });
            }
            return Ok(list);
        }

        // 2?? TEK KULLANICI GETÝR
        [HttpGet("{id}")]
        public async Task<ActionResult> Get(int id)
        {
            using var conn = Connection.GetConnection();
            await conn.OpenAsync();
            using var cmd = new SqlCommand("SELECT * FROM Kullanici WHERE KullaniciID=@id", conn);
            cmd.Parameters.AddWithValue("@id", id);
            using var reader = await cmd.ExecuteReaderAsync();

            if (await reader.ReadAsync())
            {
                return Ok(new Kullanici
                {
                    KullaniciID = reader.GetInt32(0),
                    AdSoyad = reader.GetString(1),
                    Email = reader.GetString(2),
                    SifreHash = reader.GetString(3),
                    Telefon = reader.IsDBNull(4) ? null : reader.GetString(4),
                    TCNo = reader.IsDBNull(5) ? null : reader.GetString(5),
                    AktifMi = reader.GetBoolean(6)
                });
            }
            return NotFound("Kullanýcý bulunamadý.");
        }

        // 3?? REGISTER (KAYIT OL - Rol Seçimli)
        [HttpPost("register")]
        public async Task<ActionResult> Register([FromBody] RegisterDto model)
        {
            if (model == null) return BadRequest("Veri yok.");

            // Güvenlik: Sadece izin verilen rolleri kabul et
            if (model.Rol != "Owner" && model.Rol != "Tenant")
                return BadRequest("Geçersiz rol seçimi.");

            using var conn = Connection.GetConnection();
            await conn.OpenAsync();
            using var trans = conn.BeginTransaction();

            try
            {
                // A. Email Kontrolü
                string check = "SELECT COUNT(*) FROM Kullanici WHERE Email = @Email";
                using (var cmdCheck = new SqlCommand(check, conn, trans))
                {
                    cmdCheck.Parameters.AddWithValue("@Email", model.Email);
                    if ((int)await cmdCheck.ExecuteScalarAsync() > 0)
                        return BadRequest("Bu E-posta zaten kayýtlý.");
                }

                // B. Kullanýcýyý Ekle
                string sqlUser = @"INSERT INTO Kullanici (AdSoyad, Email, SifreHash, Telefon, AktifMi, KayitTarihi) 
                                   OUTPUT INSERTED.KullaniciID
                                   VALUES (@Ad, @Email, @Sifre, @Tel, 1, GETDATE())";

                int userId;
                using (var cmdUser = new SqlCommand(sqlUser, conn, trans))
                {
                    cmdUser.Parameters.AddWithValue("@Ad", model.AdSoyad);
                    cmdUser.Parameters.AddWithValue("@Email", model.Email);
                    cmdUser.Parameters.AddWithValue("@Sifre", model.Sifre);
                    cmdUser.Parameters.AddWithValue("@Tel", (object?)model.Telefon ?? DBNull.Value);
                    userId = (int)await cmdUser.ExecuteScalarAsync();
                }

                // C. Seçilen Rolü Bul ve Ata
                int roleId = 0;
                using (var cmdRole = new SqlCommand("SELECT RolID FROM Rol WHERE RolAdi = @RolAdi", conn, trans))
                {
                    cmdRole.Parameters.AddWithValue("@RolAdi", model.Rol);
                    var res = await cmdRole.ExecuteScalarAsync();
                    if (res != null) roleId = (int)res;
                }

                if (roleId > 0)
                {
                    string sqlRole = "INSERT INTO KullaniciRol (KullaniciID, RolID) VALUES (@uid, @rid)";
                    using (var cmdAddRole = new SqlCommand(sqlRole, conn, trans))
                    {
                        cmdAddRole.Parameters.AddWithValue("@uid", userId);
                        cmdAddRole.Parameters.AddWithValue("@rid", roleId);
                        await cmdAddRole.ExecuteNonQueryAsync();
                    }
                }

                // D. Eðer "Tenant" (Kiracý) ise, Kiraci tablosuna da profil aç
                if (model.Rol == "Tenant")
                {
                    string sqlKiraci = @"INSERT INTO Kiraci (KullaniciID, AktifMi) 
                                         VALUES (@KullaniciID, 1)";
                    using (var cmdKiraci = new SqlCommand(sqlKiraci, conn, trans))
                    {
                        cmdKiraci.Parameters.AddWithValue("@KullaniciID", userId);
                        await cmdKiraci.ExecuteNonQueryAsync();
                    }
                }

                trans.Commit();
                return Ok(new { Message = "Kayýt baþarýlý! Giriþ yapabilirsiniz." });
            }
            catch (Exception ex)
            {
                trans.Rollback();
                return BadRequest("Kayýt baþarýsýz: " + ex.Message);
            }
        }

        // 4?? GÜNCELLEME (Þifre Destekli)
        [HttpPut("{id}")]
        public async Task<ActionResult> Update(int id, [FromBody] Kullanici model)
        {
            using var conn = Connection.GetConnection();
            await conn.OpenAsync();

            // Eðer þifre gönderilmiþse (doluysa) güncelle, boþsa SQL sorgusuna katma (eski þifre kalsýn)
            string passClause = string.IsNullOrEmpty(model.SifreHash) ? "" : ", SifreHash=@Sifre";

            string sql = $@"
                UPDATE Kullanici SET 
                AdSoyad=@Ad, Email=@Email, Telefon=@Tel, TCNo=@TC, AktifMi=@Aktif {passClause}
                WHERE KullaniciID=@id";

            using var cmd = new SqlCommand(sql, conn);
            cmd.Parameters.AddWithValue("@id", id);
            cmd.Parameters.AddWithValue("@Ad", model.AdSoyad);
            cmd.Parameters.AddWithValue("@Email", model.Email);
            cmd.Parameters.AddWithValue("@Tel", (object?)model.Telefon ?? DBNull.Value);
            cmd.Parameters.AddWithValue("@TC", (object?)model.TCNo ?? DBNull.Value);
            cmd.Parameters.AddWithValue("@Aktif", model.AktifMi);

            if (!string.IsNullOrEmpty(model.SifreHash))
            {
                cmd.Parameters.AddWithValue("@Sifre", model.SifreHash);
            }

            int aff = await cmd.ExecuteNonQueryAsync();
            if (aff == 0) return NotFound("Kullanýcý bulunamadý.");

            return Ok(new { Message = "Kullanýcý bilgileri güncellendi." });
        }

        // 5?? SÝLME (Soft Delete)
        [HttpDelete("{id}")]
        public async Task<ActionResult> Delete(int id)
        {
            using var conn = Connection.GetConnection();
            await conn.OpenAsync();
            using var cmd = new SqlCommand("UPDATE Kullanici SET AktifMi=0 WHERE KullaniciID=@id", conn);
            cmd.Parameters.AddWithValue("@id", id);

            int aff = await cmd.ExecuteNonQueryAsync();
            if (aff == 0) return NotFound("Kullanýcý bulunamadý.");

            return Ok(new { Message = "Kullanýcý pasif yapýldý." });
        }
    }

    // DTO Sýnýfý
    public class RegisterDto
    {
        public string AdSoyad { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string Telefon { get; set; } = string.Empty;
        public string Sifre { get; set; } = string.Empty;
        public string Rol { get; set; } = "Owner"; // Varsayýlan: Owner
    }
}