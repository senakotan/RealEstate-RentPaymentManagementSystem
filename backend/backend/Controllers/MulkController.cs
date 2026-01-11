using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using EmlakYonetimAPI.DbHelper;
using EmlakYonetimAPI.Models;
using System.Text.RegularExpressions;

namespace EmlakYonetimAPI.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class MulkController : ControllerBase
    {
        [HttpGet]
        public async Task<ActionResult<IEnumerable<MulkDetayDto>>> GetAll(int? sahipId)
        {
            var list = new List<MulkDetayDto>();

            using var conn = Connection.GetConnection();
            await conn.OpenAsync();

            string sql = @"
                SELECT 
                    M.MulkID, M.Baslik, M.Adres, M.OdaSayisi, M.Metrekare, 
                    M.AlimTarihi, M.AlimBedeli, M.AktifMi, M.Aciklama,
                    PB.Kod AS ParaBirimiKod,
                    MT.Ad AS MulkTuruAd,
                    S.SehirAdi AS SehirAd,
                    I.IlceAdi AS IlceAd,
                    K.AdSoyad AS SahipAdSoyad
                FROM Mulk M
                LEFT JOIN ParaBirimi PB ON PB.ParaBirimiID = M.ParaBirimiID
                INNER JOIN MulkTuru MT ON MT.MulkTuruID = M.MulkTuruID
                INNER JOIN Ilce I ON I.IlceID = M.IlceID
                INNER JOIN Sehir S ON S.SehirID = I.SehirID
                INNER JOIN Kullanici K ON K.KullaniciID = M.SahipKullaniciID
                WHERE (@sahipId IS NULL OR M.SahipKullaniciID = @sahipId)
                ORDER BY M.OlusturmaTarihi DESC";

            using var cmd = new SqlCommand(sql, conn);
            cmd.Parameters.AddWithValue("@sahipId", (object?)sahipId ?? DBNull.Value);

            using var reader = await cmd.ExecuteReaderAsync();

            while (await reader.ReadAsync())
            {
                list.Add(MapToDto(reader));
            }

            return Ok(list);
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<MulkDetayDto>> GetById(int id)
        {
            using var conn = Connection.GetConnection();
            await conn.OpenAsync();

            string sql = @"
                SELECT 
                    M.MulkID, M.Baslik, M.Adres, M.OdaSayisi, M.Metrekare, 
                    M.AlimTarihi, M.AlimBedeli, M.AktifMi, M.Aciklama,
                    PB.Kod AS ParaBirimiKod,
                    MT.Ad AS MulkTuruAd,
                    S.SehirAdi AS SehirAd,
                    I.IlceAdi AS IlceAd,
                    K.AdSoyad AS SahipAdSoyad
                FROM Mulk M
                LEFT JOIN ParaBirimi PB ON PB.ParaBirimiID = M.ParaBirimiID
                INNER JOIN MulkTuru MT ON MT.MulkTuruID = M.MulkTuruID
                INNER JOIN Ilce I ON I.IlceID = M.IlceID
                INNER JOIN Sehir S ON S.SehirID = I.SehirID
                INNER JOIN Kullanici K ON K.KullaniciID = M.SahipKullaniciID
                WHERE M.MulkID = @id";

            using var cmd = new SqlCommand(sql, conn);
            cmd.Parameters.AddWithValue("@id", id);

            using var reader = await cmd.ExecuteReaderAsync();

            if (!await reader.ReadAsync())
                return NotFound("Mülk bulunamadý.");

            return Ok(MapToDto(reader));
        }


        [HttpPost]
        public async Task<ActionResult> Create([FromBody] Mulk m)
        {
            if (m == null) return BadRequest("Model boþ.");

            var validationError = ValidateMulk(m);
            if (validationError != null) return BadRequest(validationError);

            try
            {
                using var conn = Connection.GetConnection();
                await conn.OpenAsync();

                if (!await ExistsAsync(conn, "Kullanici", "KullaniciID", m.SahipKullaniciID))
                    return BadRequest("Geçersiz Kullanýcý ID.");
                if (!await ExistsAsync(conn, "Ilce", "IlceID", m.IlceID))
                    return BadRequest("Geçersiz Ýlçe ID.");

                string sql = @"
                    INSERT INTO Mulk 
                    (SahipKullaniciID, MulkTuruID, IlceID, Baslik, Adres, OdaSayisi, 
                     Metrekare, AlimTarihi, AlimBedeli, ParaBirimiID, OlusturmaTarihi, AktifMi, Aciklama)
                    OUTPUT INSERTED.MulkID
                    VALUES 
                    (@Sahip, @Turu, @Ilce, @Baslik, @Adres, @Oda,
                     @Metrekare, @AlimTarihi, @AlimBedeli, @ParaBirimi, GETDATE(), @AktifMi, @Aciklama)";

                using var cmd = new SqlCommand(sql, conn);
                AddParameters(cmd, m);

                int newId = (int)await cmd.ExecuteScalarAsync();
                return Ok(new { Message = "Mülk baþarýyla eklendi.", MulkID = newId });
            }
            catch (Exception ex)
            {
                return BadRequest("Kayýt Hatasý: " + ex.Message);
            }
        }

        [HttpPut("{id}")]
        public async Task<ActionResult> Update(int id, [FromBody] Mulk m)
        {
            var validationError = ValidateMulk(m);
            if (validationError != null) return BadRequest(validationError);

            using var conn = Connection.GetConnection();
            await conn.OpenAsync();

            string sql = @"
                UPDATE Mulk SET
                    Baslik=@Baslik,
                    Adres=@Adres,
                    OdaSayisi=@Oda,
                    Metrekare=@Metrekare,
                    AlimTarihi=@AlimTarihi,
                    AlimBedeli=@AlimBedeli,
                    ParaBirimiID=@ParaBirimi,
                    AktifMi=@AktifMi,
                    Aciklama=@Aciklama,
                    MulkTuruID=@Turu,
                    IlceID=@Ilce
                WHERE MulkID=@id";

            using var cmd = new SqlCommand(sql, conn);
            cmd.Parameters.AddWithValue("@id", id);
            AddParameters(cmd, m);

            int affected = await cmd.ExecuteNonQueryAsync();
            if (affected == 0) return NotFound("Güncellenecek mülk bulunamadý.");

            return Ok(new { Message = "Mülk güncellendi." });
        }


        [HttpDelete("{id}")]
        public async Task<ActionResult> Delete(int id)
        {
            using var conn = Connection.GetConnection();
            await conn.OpenAsync();

            string sql = "UPDATE Mulk SET AktifMi = 0 WHERE MulkID = @id";
            using var cmd = new SqlCommand(sql, conn);
            cmd.Parameters.AddWithValue("@id", id);

            int affected = await cmd.ExecuteNonQueryAsync();
            if (affected == 0) return NotFound("Mülk bulunamadý.");

            return Ok(new { Message = "Mülk pasife alýndý." });
        }


        private MulkDetayDto MapToDto(SqlDataReader r)
        {
            return new MulkDetayDto
            {
                MulkID = Convert.ToInt32(r["MulkID"]),
                Baslik = r["Baslik"].ToString()!,
                Adres = r["Adres"].ToString()!,
                OdaSayisi = r["OdaSayisi"] == DBNull.Value ? null : r["OdaSayisi"].ToString(),
                Metrekare = Convert.ToDecimal(r["Metrekare"]),
                AlimTarihi = r["AlimTarihi"] == DBNull.Value ? null : Convert.ToDateTime(r["AlimTarihi"]),
                AlimBedeli = r["AlimBedeli"] == DBNull.Value ? null : Convert.ToDecimal(r["AlimBedeli"]),
                AktifMi = Convert.ToBoolean(r["AktifMi"]),
                Aciklama = r["Aciklama"] == DBNull.Value ? null : r["Aciklama"].ToString(),
                ParaBirimiKod = r["ParaBirimiKod"] == DBNull.Value ? null : r["ParaBirimiKod"].ToString(),
                MulkTuruAd = r["MulkTuruAd"].ToString()!,
                SehirAd = r["SehirAd"].ToString()!,
                IlceAd = r["IlceAd"].ToString()!,
                SahipAdSoyad = r["SahipAdSoyad"].ToString()!
            };
        }


        private void AddParameters(SqlCommand cmd, Mulk m)
        {
            cmd.Parameters.AddWithValue("@Sahip", m.SahipKullaniciID);
            cmd.Parameters.AddWithValue("@Turu", m.MulkTuruID);
            cmd.Parameters.AddWithValue("@Ilce", m.IlceID);
            cmd.Parameters.AddWithValue("@Baslik", m.Baslik);
            cmd.Parameters.AddWithValue("@Adres", m.Adres);
            cmd.Parameters.AddWithValue("@Oda", (object?)m.OdaSayisi ?? DBNull.Value);
            cmd.Parameters.AddWithValue("@Metrekare", m.Metrekare);
            cmd.Parameters.AddWithValue("@AlimTarihi", (object?)m.AlimTarihi ?? DBNull.Value);
            cmd.Parameters.AddWithValue("@AlimBedeli", (object?)m.AlimBedeli ?? DBNull.Value);
            cmd.Parameters.AddWithValue("@ParaBirimi", (object?)m.ParaBirimiID ?? DBNull.Value);
            cmd.Parameters.AddWithValue("@AktifMi", m.AktifMi);
            cmd.Parameters.AddWithValue("@Aciklama", (object?)m.Aciklama ?? DBNull.Value);
        }


        private string? ValidateMulk(Mulk m)
        {
            if (m.Metrekare <= 0) return "Metrekare 0'dan büyük olmalýdýr.";


            if (!string.IsNullOrWhiteSpace(m.OdaSayisi) && !Regex.IsMatch(m.OdaSayisi, @"^\d+\+\d+$"))
                return "Oda sayýsý formatý hatalý (Örn: 2+1, 3+1).";

            if (m.AlimBedeli.HasValue && m.AlimBedeli.Value > 0 && (!m.ParaBirimiID.HasValue || m.ParaBirimiID == 0))
                return "Alým bedeli girildiyse Para Birimi seçilmelidir.";

            return null;
        }

        private async Task<bool> ExistsAsync(SqlConnection conn, string tableName, string idColumn, int id)
        {
            string sql = $"SELECT COUNT(1) FROM {tableName} WHERE {idColumn} = @Id";
            using var cmd = new SqlCommand(sql, conn);
            cmd.Parameters.AddWithValue("@Id", id);
            return (int)await cmd.ExecuteScalarAsync() > 0;
        }


        [HttpGet("ilceAra")]
        public async Task<ActionResult> IlceAra(int sehirId, string ad)
        {
            using var conn = Connection.GetConnection();
            await conn.OpenAsync();
            var sql = "SELECT TOP 1 IlceID, IlceAdi FROM Ilce WHERE SehirID=@sid AND IlceAdi=@ad";
            using var cmd = new SqlCommand(sql, conn);
            cmd.Parameters.AddWithValue("@sid", sehirId);
            cmd.Parameters.AddWithValue("@ad", ad);
            using var r = await cmd.ExecuteReaderAsync();
            if (!r.Read()) return Ok(null);
            return Ok(new { IlceID = r["IlceID"], IlceAdi = r["IlceAdi"] });
        }

        [HttpPost("ilce")]
        public async Task<ActionResult> IlceEkle(Ilce model)
        {
            using var conn = Connection.GetConnection();
            await conn.OpenAsync();
            string sql = "INSERT INTO Ilce (SehirID, IlceAdi) OUTPUT INSERTED.IlceID VALUES (@sid, @ad)";
            using var cmd = new SqlCommand(sql, conn);
            cmd.Parameters.AddWithValue("@sid", model.SehirID);
            cmd.Parameters.AddWithValue("@ad", model.IlceAdi);
            var newId = (int)await cmd.ExecuteScalarAsync();
            return Ok(new { IlceID = newId });
        }
    }
}
