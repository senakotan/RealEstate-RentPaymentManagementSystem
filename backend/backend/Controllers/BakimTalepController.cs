using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using EmlakYonetimAPI.DbHelper;
using EmlakYonetimAPI.Models;

namespace EmlakYonetimAPI.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class BakimTalepController : ControllerBase
    {
        // --- HELPER METOTLAR ---
        private async Task LogIslem(SqlConnection conn, int? kullaniciId, string islemTuru, string tabloAdi, string kayitId, string? detay = null)
        {
            try
            {
                string logSql = @"INSERT INTO Logkayit (KullaniciID, IslemTarihi, IslemTuru, TabloAdi, KayitID, Detay) 
                                  VALUES (@KullaniciID, GETDATE(), @IslemTuru, @TabloAdi, @KayitID, @Detay)";
                using var cmd = new SqlCommand(logSql, conn);
                cmd.Parameters.AddWithValue("@KullaniciID", (object?)kullaniciId ?? DBNull.Value);
                cmd.Parameters.AddWithValue("@IslemTuru", islemTuru);
                cmd.Parameters.AddWithValue("@TabloAdi", tabloAdi);
                cmd.Parameters.AddWithValue("@KayitID", kayitId);
                cmd.Parameters.AddWithValue("@Detay", (object?)detay ?? DBNull.Value);
                await cmd.ExecuteNonQueryAsync();
            }
            catch { }
        }

        private async Task BildirimOlustur(SqlConnection conn, int kullaniciId, string baslik, string mesaj)
        {
            try
            {
                string sql = @"INSERT INTO Bildirim (KullaniciID, Baslik, Mesaj, OlusturmaTarihi, OkunduMu) 
                               VALUES (@KullaniciID, @Baslik, @Mesaj, GETDATE(), 0)";
                using var cmd = new SqlCommand(sql, conn);
                cmd.Parameters.AddWithValue("@KullaniciID", kullaniciId);
                cmd.Parameters.AddWithValue("@Baslik", baslik);
                cmd.Parameters.AddWithValue("@Mesaj", mesaj);
                await cmd.ExecuteNonQueryAsync();
            }
            catch { }
        }

        // --- API METOTLARI ---

        // 1?? MÜLKE AÝT TALEPLERÝ LÝSTELE (Kiracý Detayý Ýçin)
        [HttpGet("mulk/{mulkId}")]
        public async Task<ActionResult<IEnumerable<BakimTalep>>> GetByMulk(int mulkId)
        {
            var list = new List<BakimTalep>();
            using var conn = Connection.GetConnection();
            await conn.OpenAsync();

            string sql = @"SELECT * FROM BakimTalep WHERE MulkID=@id ORDER BY TalepTarihi DESC";

            using var cmd = new SqlCommand(sql, conn);
            cmd.Parameters.AddWithValue("@id", mulkId);

            using var r = await cmd.ExecuteReaderAsync();
            while (await r.ReadAsync())
            {
                list.Add(new BakimTalep
                {
                    BakimTalepID = Convert.ToInt32(r["BakimTalepID"]),
                    MulkID = Convert.ToInt32(r["MulkID"]),
                    TalepTarihi = Convert.ToDateTime(r["TalepTarihi"]),
                    Aciklama = r["Aciklama"].ToString(),
                    Durum = r["Durum"].ToString(),
                    // NULL Kontrolleri
                    TahminiTutar = r["TahminiTutar"] == DBNull.Value ? null : Convert.ToDecimal(r["TahminiTutar"]),
                    GerceklesmeTarihi = r["GerceklesmeTarihi"] == DBNull.Value ? null : Convert.ToDateTime(r["GerceklesmeTarihi"])
                });
            }
            return Ok(list);
        }

        // 2?? MÜLK SAHÝBÝNE GÖRE TALEPLER (Dashboard veya Listeleme Ýçin)
        // Düzeltme: DBNull deðerleri JSON serileþtirmeyi bozuyordu, null kontrolü eklendi.
        [HttpGet("owner/{ownerId}")]
        public async Task<ActionResult<IEnumerable<object>>> GetByOwner(int ownerId)
        {
            var list = new List<object>();
            using var conn = Connection.GetConnection();
            await conn.OpenAsync();

            string sql = @"
                SELECT BT.BakimTalepID, BT.MulkID, BT.TalepTarihi, BT.Aciklama, BT.Durum, 
                       BT.TahminiTutar, BT.GerceklesmeTarihi, M.Baslik AS MulkBaslik
                FROM BakimTalep BT
                INNER JOIN Mulk M ON M.MulkID = BT.MulkID
                WHERE M.SahipKullaniciID = @id
                ORDER BY BT.TalepTarihi DESC";

            using var cmd = new SqlCommand(sql, conn);
            cmd.Parameters.AddWithValue("@id", ownerId);

            using var r = await cmd.ExecuteReaderAsync();
            while (await r.ReadAsync())
            {
                list.Add(new
                {
                    BakimTalepID = Convert.ToInt32(r["BakimTalepID"]),
                    MulkID = Convert.ToInt32(r["MulkID"]),
                    MulkBaslik = r["MulkBaslik"].ToString(),
                    TalepTarihi = Convert.ToDateTime(r["TalepTarihi"]).ToString("yyyy-MM-dd"), // Formatlý Tarih
                    Aciklama = r["Aciklama"].ToString(),
                    Durum = r["Durum"].ToString(),
                    // Kritik Düzeltme: Null deðerler için kontrol
                    TahminiTutar = r["TahminiTutar"] == DBNull.Value ? null : r["TahminiTutar"],
                    GerceklesmeTarihi = r["GerceklesmeTarihi"] == DBNull.Value ? null : Convert.ToDateTime(r["GerceklesmeTarihi"]).ToString("yyyy-MM-dd")
                });
            }
            return Ok(list);
        }

        // 3?? YENÝ BAKIM TALEBÝ OLUÞTUR
        [HttpPost]
        public async Task<ActionResult> Create(BakimTalep model)
        {
            if (string.IsNullOrWhiteSpace(model.Aciklama))
                return BadRequest("Açýklama zorunludur.");

            using var conn = Connection.GetConnection();
            await conn.OpenAsync();

            string sql = @"INSERT INTO BakimTalep (MulkID, TalepTarihi, Aciklama, Durum, TahminiTutar)
                           OUTPUT INSERTED.BakimTalepID
                           VALUES (@MulkID, GETDATE(), @Aciklama, @Durum, @TahminiTutar)";

            using var cmd = new SqlCommand(sql, conn);
            cmd.Parameters.AddWithValue("@MulkID", model.MulkID);
            cmd.Parameters.AddWithValue("@Aciklama", model.Aciklama);
            cmd.Parameters.AddWithValue("@Durum", string.IsNullOrWhiteSpace(model.Durum) ? "Acik" : model.Durum);
            cmd.Parameters.AddWithValue("@TahminiTutar", (object?)model.TahminiTutar ?? DBNull.Value);

            int newId = (int)await cmd.ExecuteScalarAsync();

            // Mülk sahibini bul ve bildirim gönder
            string ownerSql = "SELECT SahipKullaniciID FROM Mulk WHERE MulkID = @MulkID";
            using (var ownerCmd = new SqlCommand(ownerSql, conn))
            {
                ownerCmd.Parameters.AddWithValue("@MulkID", model.MulkID);
                var result = await ownerCmd.ExecuteScalarAsync();
                if (result != null && result != DBNull.Value)
                {
                    await BildirimOlustur(conn, (int)result, "Yeni Bakým Talebi", $"Mülk ID {model.MulkID} için yeni bir talep var.");
                }
            }

            await LogIslem(conn, null, "INSERT", "BakimTalep", newId.ToString(), $"Talep: {model.Aciklama}");
            return Ok(new { Message = "Bakým talebi oluþturuldu.", ID = newId });
        }

        // 4?? DURUM GÜNCELLEME
        [HttpPut("{id}/durum")]
        public async Task<ActionResult> UpdateStatus(int id, [FromBody] BakimDurumDto dto)
        {
            if (dto == null) return BadRequest("Veri eksik.");

            using var conn = Connection.GetConnection();
            await conn.OpenAsync();

            string sql = @"UPDATE BakimTalep
                           SET Durum = @Durum,
                               TahminiTutar = COALESCE(@GercekTutar, TahminiTutar),
                               GerceklesmeTarihi = CASE 
                                                       WHEN @Durum = 'Tamamlandi' AND GerceklesmeTarihi IS NULL THEN GETDATE()
                                                       ELSE GerceklesmeTarihi 
                                                   END
                           WHERE BakimTalepID = @id";

            using var cmd = new SqlCommand(sql, conn);
            cmd.Parameters.AddWithValue("@id", id);
            cmd.Parameters.AddWithValue("@Durum", dto.Durum);
            cmd.Parameters.AddWithValue("@GercekTutar", (object?)dto.GercekTutar ?? DBNull.Value);

            int affected = await cmd.ExecuteNonQueryAsync();
            if (affected == 0) return NotFound("Talep bulunamadý.");

            // Tamamlandýysa Mülk Sahibine Bildirim
            if (dto.Durum == "Tamamlandi")
            {
                string ownerSql = "SELECT SahipKullaniciID, MulkID FROM Mulk WHERE MulkID = (SELECT MulkID FROM BakimTalep WHERE BakimTalepID=@id)";
                using var ownerCmd = new SqlCommand(ownerSql, conn);
                ownerCmd.Parameters.AddWithValue("@id", id);
                using var r = await ownerCmd.ExecuteReaderAsync();
                if (await r.ReadAsync())
                {
                    int ownerId = r.GetInt32(0);
                    int mulkId = r.GetInt32(1);
                    r.Close(); // Reader'ý kapatýyoruz
                    await BildirimOlustur(conn, ownerId, "Bakým Tamamlandý", $"Mülk ID {mulkId} talebi tamamlandý.");
                }
            }

            await LogIslem(conn, null, "UPDATE", "BakimTalep", id.ToString(), $"Durum: {dto.Durum}, Tutar: {dto.GercekTutar}");
            return Ok("Talep güncellendi.");
        }

        // 5?? SÝL
        [HttpDelete("{id}")]
        public async Task<ActionResult> Delete(int id)
        {
            using var conn = Connection.GetConnection();
            await conn.OpenAsync();

            string infoSql = "SELECT MulkID FROM BakimTalep WHERE BakimTalepID=@id";
            int? mulkId = null;
            using (var infoCmd = new SqlCommand(infoSql, conn))
            {
                infoCmd.Parameters.AddWithValue("@id", id);
                var res = await infoCmd.ExecuteScalarAsync();
                if (res != null && res != DBNull.Value) mulkId = (int)res;
            }

            string sql = "DELETE FROM BakimTalep WHERE BakimTalepID=@id";
            using (var cmd = new SqlCommand(sql, conn))
            {
                cmd.Parameters.AddWithValue("@id", id);
                int aff = await cmd.ExecuteNonQueryAsync();
                if (aff == 0) return NotFound("Talep bulunamadý.");
            }

            await LogIslem(conn, null, "DELETE", "BakimTalep", id.ToString(), $"Mülk ID: {mulkId} talebi silindi.");
            return Ok("Talep silindi.");
        }
    }

    public class BakimDurumDto
    {
        public string Durum { get; set; } = string.Empty;
        public decimal? GercekTutar { get; set; }
    }
}