using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using EmlakYonetimAPI.DbHelper;
using EmlakYonetimAPI.Models;

namespace EmlakYonetimAPI.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class BankaHesapController : ControllerBase
    {
        [HttpGet("user/{userId}")]
        public async Task<ActionResult> GetByUser(int userId)
        {
            var list = new List<object>();
            using var conn = Connection.GetConnection();
            await conn.OpenAsync();

            string sql = @"
                SELECT BH.BankaHesapID, BH.Iban, BH.HesapAdi, BH.AktifMi, B.BankaAdi 
                FROM BankaHesap BH
                INNER JOIN Banka B ON B.BankaID = BH.BankaID
                WHERE BH.KullaniciID = @uid
                ORDER BY BH.AktifMi DESC";

            using var cmd = new SqlCommand(sql, conn);
            cmd.Parameters.AddWithValue("@uid", userId);

            using var r = await cmd.ExecuteReaderAsync();
            while (await r.ReadAsync())
            {
                list.Add(new
                {
                    BankaHesapID = r["BankaHesapID"],
                    BankaAdi = r["BankaAdi"],
                    Iban = r["Iban"],
                    HesapAdi = r["HesapAdi"],
                    AktifMi = r["AktifMi"]
                });
            }
            return Ok(list);
        }

        [HttpPost]
        public async Task<ActionResult> Create(BankaHesap model)
        {
            if (string.IsNullOrWhiteSpace(model.Iban)) return BadRequest("IBAN zorunludur.");

            using var conn = Connection.GetConnection();
            await conn.OpenAsync();

            var checkCmd = new SqlCommand("SELECT COUNT(*) FROM BankaHesap WHERE Iban = @iban", conn);
            checkCmd.Parameters.AddWithValue("@iban", model.Iban);
            if ((int)await checkCmd.ExecuteScalarAsync() > 0)
                return BadRequest("Bu IBAN zaten sistemde kayıtlı.");

            string sql = @"INSERT INTO BankaHesap (KullaniciID, BankaID, Iban, HesapAdi, AktifMi) 
                           VALUES (@uid, @bid, @iban, @adi, 1)";

            using var cmd = new SqlCommand(sql, conn);
            cmd.Parameters.AddWithValue("@uid", model.KullaniciID);
            cmd.Parameters.AddWithValue("@bid", model.BankaID);
            cmd.Parameters.AddWithValue("@iban", model.Iban);
            cmd.Parameters.AddWithValue("@adi", (object?)model.HesapAdi ?? DBNull.Value);

            await cmd.ExecuteNonQueryAsync();
            return Ok("Banka hesabı eklendi.");
        }


        [HttpPut("{id}")]
        public async Task<ActionResult> Update(int id, BankaHesap model)
        {
            using var conn = Connection.GetConnection();
            await conn.OpenAsync();

            string sql = @"UPDATE BankaHesap SET 
                           BankaID=@bid, Iban=@iban, HesapAdi=@adi, AktifMi=@aktif 
                           WHERE BankaHesapID=@id";

            using var cmd = new SqlCommand(sql, conn);
            cmd.Parameters.AddWithValue("@id", id);
            cmd.Parameters.AddWithValue("@bid", model.BankaID);
            cmd.Parameters.AddWithValue("@iban", model.Iban);
            cmd.Parameters.AddWithValue("@adi", (object?)model.HesapAdi ?? DBNull.Value);
            cmd.Parameters.AddWithValue("@aktif", model.AktifMi);

            int aff = await cmd.ExecuteNonQueryAsync();
            if (aff == 0) return NotFound("Hesap bulunamadı.");

            return Ok("Hesap güncellendi.");
        }

        [HttpDelete("{id}")]
        public async Task<ActionResult> Delete(int id)
        {
            using var conn = Connection.GetConnection();
            await conn.OpenAsync();
            var cmd = new SqlCommand("UPDATE BankaHesap SET AktifMi = 0 WHERE BankaHesapID = @id", conn);
            cmd.Parameters.AddWithValue("@id", id);
            await cmd.ExecuteNonQueryAsync();
            return Ok("Hesap pasife alındı.");
        }
    }
}
