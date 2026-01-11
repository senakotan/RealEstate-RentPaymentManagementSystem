using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using EmlakYonetimAPI.DbHelper;
using EmlakYonetimAPI.Models;

namespace EmlakYonetimAPI.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class KiraciController : ControllerBase
    {
        [HttpGet]
        public async Task<ActionResult<IEnumerable<KiraciDetayDto>>> GetAll()
        {
            var list = new List<KiraciDetayDto>();
            using var conn = Connection.GetConnection();
            await conn.OpenAsync();

            string sql = @"
                SELECT K.KiraciID, K.KullaniciID, K.AktifMi,
                       U.AdSoyad, U.Email, U.Telefon, U.TCNo
                FROM Kiraci K
                INNER JOIN Kullanici U ON K.KullaniciID = U.KullaniciID
                ORDER BY U.AdSoyad";

            using var cmd = new SqlCommand(sql, conn);
            using var r = await cmd.ExecuteReaderAsync();
            while (await r.ReadAsync()) 
            { 
                list.Add(MapToKiraciDetay(r)); 
            }
            return Ok(list);
        }

        [HttpGet("owner/{ownerId}")]
        public async Task<ActionResult> GetByOwner(int ownerId)
        {
            var list = new List<object>();
            using var conn = Connection.GetConnection();
            await conn.OpenAsync();

            string sql = @"
                SELECT DISTINCT 
                    K.KiraciID, 
                    K.KullaniciID,
                    K.AktifMi,
                    U.AdSoyad, 
                    U.Email, 
                    U.Telefon, 
                    U.TCNo
                FROM Kiraci K
                INNER JOIN Kullanici U ON K.KullaniciID = U.KullaniciID
                INNER JOIN KiraSozlesme KS ON K.KiraciID = KS.KiraciID
                INNER JOIN Mulk M ON KS.MulkID = M.MulkID
                WHERE M.SahipKullaniciID = @id
                ORDER BY U.AdSoyad";

            using var cmd = new SqlCommand(sql, conn);
            cmd.Parameters.AddWithValue("@id", ownerId);
            using var r = await cmd.ExecuteReaderAsync();
            while (await r.ReadAsync())
            {
                list.Add(new
                {
                    KiraciID = r["KiraciID"],
                    KullaniciID = r["KullaniciID"],
                    AdSoyad = r["AdSoyad"].ToString(),
                    Email = r["Email"].ToString(),
                    Telefon = r["Telefon"] == DBNull.Value ? "-" : r["Telefon"].ToString(),
                    TCNo = r["TCNo"] == DBNull.Value ? "-" : r["TCNo"].ToString(),
                    AktifMi = r["AktifMi"]
                });
            }
            return Ok(list);
        }

        [HttpPost]
        public async Task<ActionResult> Create([FromBody] CreateKiraciRequest request)
        {
            if (request == null) return BadRequest("Model boş.");
            if (string.IsNullOrWhiteSpace(request.Email)) 
                return BadRequest("E-posta zorunludur.");
            if (string.IsNullOrWhiteSpace(request.AdSoyad)) 
                return BadRequest("Ad Soyad zorunludur.");

            using var conn = Connection.GetConnection();
            await conn.OpenAsync();

            using var trans = conn.BeginTransaction();

            try
            {
                int kullaniciID = 0;

                string checkUserSql = "SELECT KullaniciID FROM Kullanici WHERE Email = @Email";
                using (var cmdCheck = new SqlCommand(checkUserSql, conn, trans))
                {
                    cmdCheck.Parameters.AddWithValue("@Email", request.Email);
                    var res = await cmdCheck.ExecuteScalarAsync();

                    if (res != null)
                    {
                        kullaniciID = (int)res;
                        
                        string checkKiraciSql = "SELECT COUNT(*) FROM Kiraci WHERE KullaniciID = @KullaniciID";
                        using (var cmdCheckKiraci = new SqlCommand(checkKiraciSql, conn, trans))
                        {
                            cmdCheckKiraci.Parameters.AddWithValue("@KullaniciID", kullaniciID);
                            int kiraciCount = (int)await cmdCheckKiraci.ExecuteScalarAsync();
                            
                            if (kiraciCount > 0)
                            {
                                trans.Rollback();
                                return BadRequest("Bu kullanıcı zaten kiracı olarak kayıtlı.");
                            }
                        }
                    }
                    else
                    {
                        string insertUserSql = @"
                            INSERT INTO Kullanici (AdSoyad, Email, SifreHash, Telefon, TCNo, AktifMi, KayitTarihi) 
                            OUTPUT INSERTED.KullaniciID
                            VALUES (@Ad, @Email, @Sifre, @Tel, @Tc, 1, GETDATE())";

                        using (var cmdUser = new SqlCommand(insertUserSql, conn, trans))
                        {
                            cmdUser.Parameters.AddWithValue("@Ad", request.AdSoyad);
                            cmdUser.Parameters.AddWithValue("@Email", request.Email);
                            cmdUser.Parameters.AddWithValue("@Sifre", string.IsNullOrWhiteSpace(request.Sifre) ? "12345" : request.Sifre);
                            cmdUser.Parameters.AddWithValue("@Tel", (object?)request.Telefon ?? DBNull.Value);
                            cmdUser.Parameters.AddWithValue("@Tc", (object?)request.TCNo ?? DBNull.Value);
                            kullaniciID = (int)await cmdUser.ExecuteScalarAsync();
                        }
                    }
                }
                
                int tenantRoleId = 0;
                using (var cmdRole = new SqlCommand("SELECT RolID FROM Rol WHERE RolAdi = 'Tenant'", conn, trans))
                {
                    var rRes = await cmdRole.ExecuteScalarAsync();
                    if (rRes != null) tenantRoleId = (int)rRes;
                }

                if (tenantRoleId > 0 && kullaniciID > 0)
                {
                    string checkRole = "SELECT COUNT(*) FROM KullaniciRol WHERE KullaniciID=@uid AND RolID=@rid";
                    using (var cmdCheckRole = new SqlCommand(checkRole, conn, trans))
                    {
                        cmdCheckRole.Parameters.AddWithValue("@uid", kullaniciID);
                        cmdCheckRole.Parameters.AddWithValue("@rid", tenantRoleId);
                        int count = (int)await cmdCheckRole.ExecuteScalarAsync();

                        if (count == 0)
                        {
                            string addRoleSql = "INSERT INTO KullaniciRol (KullaniciID, RolID, AtamaTarihi) VALUES (@uid, @rid, GETDATE())";
                            using (var cmdAddRole = new SqlCommand(addRoleSql, conn, trans))
                            {
                                cmdAddRole.Parameters.AddWithValue("@uid", kullaniciID);
                                cmdAddRole.Parameters.AddWithValue("@rid", tenantRoleId);
                                await cmdAddRole.ExecuteNonQueryAsync();
                            }
                        }
                    }
                }
                string insertKiraciSql = @"
                    INSERT INTO Kiraci (KullaniciID, AktifMi)
                    OUTPUT INSERTED.KiraciID
                    VALUES (@KullaniciID, 1)";

                int newKiraciID = 0;
                using (var cmdKiraci = new SqlCommand(insertKiraciSql, conn, trans))
                {
                    cmdKiraci.Parameters.AddWithValue("@KullaniciID", kullaniciID);
                    newKiraciID = (int)await cmdKiraci.ExecuteScalarAsync();
                }

                trans.Commit();
                return Ok(new { 
                    Message = "Kiracı başarıyla oluşturuldu.", 
                    KiraciID = newKiraciID,
                    KullaniciID = kullaniciID
                });
            }
            catch (Exception ex)
            {
                trans.Rollback();
                if (ex.Message.Contains("UNIQUE") || ex.Message.Contains("duplicate"))
                    return BadRequest("Bu e-posta adresi zaten kayıtlı.");

                return BadRequest("İşlem sırasında hata: " + ex.Message);
            }
        }

        [HttpGet("aktif")]
        public async Task<ActionResult<IEnumerable<KiraciDetayDto>>> GetAktif()
        {
            var list = new List<KiraciDetayDto>();
            using var conn = Connection.GetConnection();
            await conn.OpenAsync();
            
            string sql = @"
                SELECT K.KiraciID, K.KullaniciID, K.AktifMi,
                       U.AdSoyad, U.Email, U.Telefon, U.TCNo
                FROM Kiraci K
                INNER JOIN Kullanici U ON K.KullaniciID = U.KullaniciID
                WHERE K.AktifMi = 1
                ORDER BY U.AdSoyad";
            
            using var cmd = new SqlCommand(sql, conn);
            using var r = await cmd.ExecuteReaderAsync();
            while (await r.ReadAsync()) 
            { 
                list.Add(MapToKiraciDetay(r)); 
            }
            return Ok(list);
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<KiraciDetayDto>> GetById(int id)
        {
            using var conn = Connection.GetConnection();
            await conn.OpenAsync();

            string sql = @"
                SELECT K.KiraciID, K.KullaniciID, K.AktifMi,
                       U.AdSoyad, U.Email, U.Telefon, U.TCNo
                FROM Kiraci K
                INNER JOIN Kullanici U ON K.KullaniciID = U.KullaniciID
                WHERE K.KiraciID = @id";

            using var cmd = new SqlCommand(sql, conn);
            cmd.Parameters.AddWithValue("@id", id);
            using var r = await cmd.ExecuteReaderAsync();
            
            if (await r.ReadAsync())
            {
                return Ok(MapToKiraciDetay(r));
            }

            return NotFound("Kiracı bulunamadı.");
        }

        [HttpGet("kullanici/{kullaniciId}")]
        public async Task<ActionResult<KiraciDetayDto>> GetByKullaniciId(int kullaniciId)
        {
            using var conn = Connection.GetConnection();
            await conn.OpenAsync();

            string sql = @"
                SELECT K.KiraciID, K.KullaniciID, K.AktifMi,
                       U.AdSoyad, U.Email, U.Telefon, U.TCNo
                FROM Kiraci K
                INNER JOIN Kullanici U ON K.KullaniciID = U.KullaniciID
                WHERE K.KullaniciID = @kullaniciId";

            using var cmd = new SqlCommand(sql, conn);
            cmd.Parameters.AddWithValue("@kullaniciId", kullaniciId);
            using var r = await cmd.ExecuteReaderAsync();
            
            if (await r.ReadAsync())
            {
                return Ok(MapToKiraciDetay(r));
            }

            return NotFound("Kiracı bulunamadı.");
        }

        [HttpPut("{id}")]
        public async Task<ActionResult> Update(int id, [FromBody] UpdateKiraciRequest request)
        {
            if (request == null) return BadRequest("Model boş.");

            using var conn = Connection.GetConnection();
            await conn.OpenAsync();

            string sql = @"UPDATE Kiraci SET AktifMi = @AktifMi WHERE KiraciID = @id";

            using var cmd = new SqlCommand(sql, conn);
            cmd.Parameters.AddWithValue("@id", id);
            cmd.Parameters.AddWithValue("@AktifMi", request.AktifMi);

            int affected = await cmd.ExecuteNonQueryAsync();
            
            if (affected > 0)
                return Ok(new { Message = "Kiracı güncellendi." });
            else
                return NotFound("Kiracı bulunamadı.");
        }

        [HttpDelete("{id}")]
        public async Task<ActionResult> Delete(int id)
        {
            using var conn = Connection.GetConnection();
            await conn.OpenAsync();

            string sql = @"UPDATE Kiraci SET AktifMi = 0 WHERE KiraciID = @id";

            using var cmd = new SqlCommand(sql, conn);
            cmd.Parameters.AddWithValue("@id", id);

            int affected = await cmd.ExecuteNonQueryAsync();
            
            if (affected > 0)
                return Ok(new { Message = "Kiracı pasif edildi." });
            else
                return NotFound("Kiracı bulunamadı.");
        }

        private KiraciDetayDto MapToKiraciDetay(SqlDataReader r)
        {
            return new KiraciDetayDto
            {
                KiraciID = Convert.ToInt32(r["KiraciID"]),
                KullaniciID = Convert.ToInt32(r["KullaniciID"]),
                AdSoyad = r["AdSoyad"].ToString()!,
                Email = r["Email"].ToString()!,
                Telefon = r["Telefon"] == DBNull.Value ? null : r["Telefon"].ToString(),
                TCNo = r["TCNo"] == DBNull.Value ? null : r["TCNo"].ToString(),
                AktifMi = Convert.ToBoolean(r["AktifMi"])
            };
        }
    }

    public class CreateKiraciRequest
    {
        public string AdSoyad { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string? Telefon { get; set; }
        public string? TCNo { get; set; }
        public string? Sifre { get; set; }
    }

    public class UpdateKiraciRequest
    {
        public bool AktifMi { get; set; }
    }
}
