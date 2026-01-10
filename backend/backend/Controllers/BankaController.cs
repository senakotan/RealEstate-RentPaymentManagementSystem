using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using EmlakYonetimAPI.DbHelper;
using EmlakYonetimAPI.Models;

namespace EmlakYonetimAPI.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class BankaController : ControllerBase
    {
        // 1️⃣ LİSTELE
        [HttpGet]
        public async Task<ActionResult<IEnumerable<Banka>>> GetAll()
        {
            var list = new List<Banka>();
            using var conn = Connection.GetConnection();
            await conn.OpenAsync();

            using var cmd = new SqlCommand("SELECT * FROM Banka ORDER BY BankaAdi", conn);
            using var r = await cmd.ExecuteReaderAsync();

            while (await r.ReadAsync())
            {
                list.Add(new Banka
                {
                    BankaID = Convert.ToInt32(r["BankaID"]),
                    BankaAdi = r["BankaAdi"].ToString()!,
                    Aciklama = r["Aciklama"] == DBNull.Value ? null : r["Aciklama"].ToString()
                });
            }
            return Ok(list);
        }

        // 2️⃣ EKLE (Duplicate Kontrollü)
        [HttpPost]
        public async Task<ActionResult> Create(Banka model)
        {
            if (string.IsNullOrWhiteSpace(model.BankaAdi))
                return BadRequest("Banka adı zorunludur.");

            using var conn = Connection.GetConnection();
            await conn.OpenAsync();

            // Aynı isimde banka var mı?
            var checkCmd = new SqlCommand("SELECT COUNT(*) FROM Banka WHERE BankaAdi = @Ad", conn);
            checkCmd.Parameters.AddWithValue("@Ad", model.BankaAdi);
            if ((int)await checkCmd.ExecuteScalarAsync() > 0)
                return BadRequest("Bu banka zaten kayıtlı.");

            var sql = "INSERT INTO Banka (BankaAdi, Aciklama) VALUES (@Ad, @Aciklama)";
            using var cmd = new SqlCommand(sql, conn);
            cmd.Parameters.AddWithValue("@Ad", model.BankaAdi);
            cmd.Parameters.AddWithValue("@Aciklama", (object?)model.Aciklama ?? DBNull.Value);

            await cmd.ExecuteNonQueryAsync();
            return Ok("Banka eklendi.");
        }

        // 3️⃣ GÜNCELLE
        [HttpPut("{id}")]
        public async Task<ActionResult> Update(int id, Banka model)
        {
            using var conn = Connection.GetConnection();
            await conn.OpenAsync();

            var sql = "UPDATE Banka SET BankaAdi=@Ad, Aciklama=@Acik WHERE BankaID=@id";
            using var cmd = new SqlCommand(sql, conn);
            cmd.Parameters.AddWithValue("@id", id);
            cmd.Parameters.AddWithValue("@Ad", model.BankaAdi);
            cmd.Parameters.AddWithValue("@Aciklama", (object?)model.Aciklama ?? DBNull.Value);

            int aff = await cmd.ExecuteNonQueryAsync();
            if (aff == 0) return NotFound("Banka bulunamadı.");

            return Ok("Banka güncellendi.");
        }

        // 4️⃣ SİL (Kullanımda mı kontrolü ile)
        [HttpDelete("{id}")]
        public async Task<ActionResult> Delete(int id)
        {
            using var conn = Connection.GetConnection();
            await conn.OpenAsync();

            try
            {
                var sql = "DELETE FROM Banka WHERE BankaID = @id";
                using var cmd = new SqlCommand(sql, conn);
                cmd.Parameters.AddWithValue("@id", id);

                int aff = await cmd.ExecuteNonQueryAsync();
                if (aff == 0) return NotFound("Banka bulunamadı.");

                return Ok("Banka silindi.");
            }
            catch (SqlException ex)
            {
                // FK Hatası (547) genelde "Bu kayıt başka bir tabloda kullanılıyor" demektir.
                if (ex.Number == 547)
                    return BadRequest("Bu banka bazı hesaplarda kullanıldığı için silinemez.");

                return BadRequest("Silme işleminde hata: " + ex.Message);
            }
        }
    }
}