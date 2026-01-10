using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using EmlakYonetimAPI.DbHelper;
using EmlakYonetimAPI.Models;

namespace EmlakYonetimAPI.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class MulkDegerlemeController : ControllerBase
    {
        // 1️⃣ MÜLK DEĞERLEMELERİNİ GETİR
        [HttpGet("mulk/{mulkId}")]
        public async Task<ActionResult<IEnumerable<object>>> GetByMulk(int mulkId)
        {
            var list = new List<object>();

            using var conn = Connection.GetConnection();
            await conn.OpenAsync();

            string sql = @"
                SELECT 
                    MD.MulkDegerlemeID, MD.MulkID, MD.DegerTarihi, MD.TahminiDeger,
                    MD.ParaBirimiID, MD.Kaynak, MD.Aciklama,
                    PB.Kod AS ParaBirimiKod, PB.Sembol AS ParaBirimiSembol
                FROM MulkDegerleme MD
                LEFT JOIN ParaBirimi PB ON PB.ParaBirimiID = MD.ParaBirimiID
                WHERE MD.MulkID = @mulkId
                ORDER BY MD.DegerTarihi DESC";

            using var cmd = new SqlCommand(sql, conn);
            cmd.Parameters.AddWithValue("@mulkId", mulkId);

            using var reader = await cmd.ExecuteReaderAsync();

            while (await reader.ReadAsync())
            {
                list.Add(new
                {
                    MulkDegerlemeID = Convert.ToInt32(reader["MulkDegerlemeID"]),
                    MulkID = Convert.ToInt32(reader["MulkID"]),
                    DegerTarihi = Convert.ToDateTime(reader["DegerTarihi"]).ToString("dd.MM.yyyy"),
                    TahminiDeger = Convert.ToDecimal(reader["TahminiDeger"]),
                    ParaBirimiID = Convert.ToInt32(reader["ParaBirimiID"]),
                    ParaBirimiKod = reader["ParaBirimiKod"] == DBNull.Value ? "TL" : reader["ParaBirimiKod"].ToString(),
                    ParaBirimiSembol = reader["ParaBirimiSembol"] == DBNull.Value ? "₺" : reader["ParaBirimiSembol"].ToString(),
                    Kaynak = reader["Kaynak"] == DBNull.Value ? null : reader["Kaynak"].ToString(),
                    Aciklama = reader["Aciklama"] == DBNull.Value ? null : reader["Aciklama"].ToString()
                });
            }

            return Ok(list);
        }

        // 2️⃣ DEĞERLEME EKLE
        [HttpPost]
        public async Task<ActionResult> Create([FromBody] MulkDegerleme model)
        {
            if (model == null)
                return BadRequest("Model boş.");

            if (model.TahminiDeger <= 0)
                return BadRequest("Tahmini değer 0'dan büyük olmalıdır.");

            using var conn = Connection.GetConnection();
            await conn.OpenAsync();

            // Mülk kontrolü
            string checkSql = "SELECT COUNT(1) FROM Mulk WHERE MulkID = @id";
            using var checkCmd = new SqlCommand(checkSql, conn);
            checkCmd.Parameters.AddWithValue("@id", model.MulkID);
            if ((int)await checkCmd.ExecuteScalarAsync() == 0)
                return BadRequest("Geçersiz Mülk ID.");

            // Para birimi kontrolü
            checkSql = "SELECT COUNT(1) FROM ParaBirimi WHERE ParaBirimiID = @id";
            using var checkCmd2 = new SqlCommand(checkSql, conn);
            checkCmd2.Parameters.AddWithValue("@id", model.ParaBirimiID);
            if ((int)await checkCmd2.ExecuteScalarAsync() == 0)
                return BadRequest("Geçersiz Para Birimi ID.");

            string sql = @"
                INSERT INTO MulkDegerleme (MulkID, DegerTarihi, TahminiDeger, ParaBirimiID, Kaynak, Aciklama)
                OUTPUT INSERTED.MulkDegerlemeID
                VALUES (@MulkID, @DegerTarihi, @TahminiDeger, @ParaBirimiID, @Kaynak, @Aciklama)";

            using var cmd = new SqlCommand(sql, conn);
            cmd.Parameters.AddWithValue("@MulkID", model.MulkID);
            cmd.Parameters.AddWithValue("@DegerTarihi", model.DegerTarihi);
            cmd.Parameters.AddWithValue("@TahminiDeger", model.TahminiDeger);
            cmd.Parameters.AddWithValue("@ParaBirimiID", model.ParaBirimiID);
            cmd.Parameters.AddWithValue("@Kaynak", (object?)model.Kaynak ?? DBNull.Value);
            cmd.Parameters.AddWithValue("@Aciklama", (object?)model.Aciklama ?? DBNull.Value);

            int newId = (int)await cmd.ExecuteScalarAsync();
            return Ok(new { Message = "Değerleme eklendi.", MulkDegerlemeID = newId });
        }

        // 3️⃣ DEĞERLEME SİL
        [HttpDelete("{id}")]
        public async Task<ActionResult> Delete(int id)
        {
            using var conn = Connection.GetConnection();
            await conn.OpenAsync();

            string sql = "DELETE FROM MulkDegerleme WHERE MulkDegerlemeID = @id";
            using var cmd = new SqlCommand(sql, conn);
            cmd.Parameters.AddWithValue("@id", id);

            int affected = await cmd.ExecuteNonQueryAsync();
            if (affected == 0) return NotFound("Değerleme bulunamadı.");

            return Ok(new { Message = "Değerleme silindi." });
        }
    }
}

