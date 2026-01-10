using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using EmlakYonetimAPI.DbHelper;
using EmlakYonetimAPI.Models;

namespace EmlakYonetimAPI.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class BildirimController : ControllerBase
    {
        // 1?? KULLANICININ BÝLDÝRÝMLERÝ (Okunmamýþlar üstte)
        [HttpGet("kullanici/{kullaniciId}")]
        public async Task<ActionResult<IEnumerable<Bildirim>>> GetByUser(int kullaniciId)
        {
            var list = new List<Bildirim>();
            using var conn = Connection.GetConnection();
            await conn.OpenAsync();

            string sql = @"SELECT * FROM Bildirim 
                           WHERE KullaniciID = @id 
                           ORDER BY OkunduMu ASC, OlusturmaTarihi DESC";

            using var cmd = new SqlCommand(sql, conn);
            cmd.Parameters.AddWithValue("@id", kullaniciId);

            using var r = await cmd.ExecuteReaderAsync();
            while (await r.ReadAsync())
            {
                list.Add(new Bildirim
                {
                    BildirimID = Convert.ToInt32(r["BildirimID"]),
                    KullaniciID = Convert.ToInt32(r["KullaniciID"]),
                    Baslik = r["Baslik"].ToString(),
                    Mesaj = r["Mesaj"].ToString(),
                    OlusturmaTarihi = Convert.ToDateTime(r["OlusturmaTarihi"]),
                    OkunduMu = Convert.ToBoolean(r["OkunduMu"]),
                    OkunmaTarihi = r["OkunmaTarihi"] == DBNull.Value ? null : Convert.ToDateTime(r["OkunmaTarihi"])
                });
            }
            return Ok(list);
        }

        // 2?? OKUNMAMIÞ BÝLDÝRÝM SAYISI (Badge için)
        [HttpGet("unread-count/{kullaniciId}")]
        public async Task<ActionResult<int>> GetUnreadCount(int kullaniciId)
        {
            using var conn = Connection.GetConnection();
            await conn.OpenAsync();
            var cmd = new SqlCommand("SELECT COUNT(*) FROM Bildirim WHERE KullaniciID=@id AND OkunduMu=0", conn);
            cmd.Parameters.AddWithValue("@id", kullaniciId);
            return Ok((int)await cmd.ExecuteScalarAsync());
        }

        // 3?? YENÝ BÝLDÝRÝM OLUÞTUR (Sistem veya Admin)
        [HttpPost]
        public async Task<ActionResult> Create(Bildirim model)
        {
            if (string.IsNullOrWhiteSpace(model.Baslik) || string.IsNullOrWhiteSpace(model.Mesaj))
                return BadRequest("Baþlýk ve mesaj zorunludur.");

            using var conn = Connection.GetConnection();
            await conn.OpenAsync();

            string sql = @"INSERT INTO Bildirim (KullaniciID, Baslik, Mesaj, OlusturmaTarihi, OkunduMu)
                           VALUES (@uid, @baslik, @mesaj, GETDATE(), 0)";

            using var cmd = new SqlCommand(sql, conn);
            cmd.Parameters.AddWithValue("@uid", model.KullaniciID);
            cmd.Parameters.AddWithValue("@baslik", model.Baslik);
            cmd.Parameters.AddWithValue("@mesaj", model.Mesaj);

            await cmd.ExecuteNonQueryAsync();
            return Ok("Bildirim gönderildi.");
        }

        // 4?? OKUNDU OLARAK ÝÞARETLE
        [HttpPut("read/{id}")]
        public async Task<ActionResult> MarkAsRead(int id)
        {
            using var conn = Connection.GetConnection();
            await conn.OpenAsync();
            var cmd = new SqlCommand("UPDATE Bildirim SET OkunduMu = 1, OkunmaTarihi = GETDATE() WHERE BildirimID = @id", conn);
            cmd.Parameters.AddWithValue("@id", id);

            int aff = await cmd.ExecuteNonQueryAsync();
            if (aff == 0) return NotFound("Bildirim bulunamadý.");

            return Ok("Okundu iþaretlendi.");
        }

        // 5?? TÜMÜNÜ OKUNDU ÝÞARETLE
        [HttpPut("read-all/{kullaniciId}")]
        public async Task<ActionResult> MarkAllRead(int kullaniciId)
        {
            using var conn = Connection.GetConnection();
            await conn.OpenAsync();
            var cmd = new SqlCommand("UPDATE Bildirim SET OkunduMu = 1, OkunmaTarihi = GETDATE() WHERE KullaniciID = @uid AND OkunduMu = 0", conn);
            cmd.Parameters.AddWithValue("@uid", kullaniciId);
            await cmd.ExecuteNonQueryAsync();
            return Ok("Tüm bildirimler okundu.");
        }

        // 6?? SÝL
        [HttpDelete("{id}")]
        public async Task<ActionResult> Delete(int id)
        {
            using var conn = Connection.GetConnection();
            await conn.OpenAsync();
            var cmd = new SqlCommand("DELETE FROM Bildirim WHERE BildirimID = @id", conn);
            cmd.Parameters.AddWithValue("@id", id);

            int aff = await cmd.ExecuteNonQueryAsync();
            if (aff == 0) return NotFound("Bildirim bulunamadý.");

            return Ok("Bildirim silindi.");
        }
    }
}