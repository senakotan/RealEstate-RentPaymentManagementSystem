using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using EmlakYonetimAPI.DbHelper;
using EmlakYonetimAPI.Models;

namespace EmlakYonetimAPI.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class HatirlaticiController : ControllerBase
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

        // 1️⃣ LİSTELE (Kullanıcıya Göre)
        [HttpGet("kullanici/{kullaniciId}")]
        public async Task<ActionResult<IEnumerable<object>>> GetByKullanici(int kullaniciId, bool? aktifMi = true) // Varsayılan: Sadece aktifler
        {
            var list = new List<object>();

            using var conn = Connection.GetConnection();
            await conn.OpenAsync();

            string sql = @"
                SELECT 
                    H.HatirlaticiID, H.KullaniciID, H.IlgiliMulkID, H.IlgiliKiraSozlesmeID,
                    H.Baslik, H.Aciklama, H.HatirlaticiTarihi, H.AktifMi,
                    M.Baslik AS MulkBaslik, KS.SozlesmeNo
                FROM Hatirlatici H
                LEFT JOIN Mulk M ON M.MulkID = H.IlgiliMulkID
                LEFT JOIN KiraSozlesme KS ON KS.KiraSozlesmeID = H.IlgiliKiraSozlesmeID
                WHERE H.KullaniciID = @id";

            if (aktifMi.HasValue)
                sql += " AND H.AktifMi = @aktifMi";

            sql += " ORDER BY H.HatirlaticiTarihi ASC";

            using var cmd = new SqlCommand(sql, conn);
            cmd.Parameters.AddWithValue("@id", kullaniciId);
            if (aktifMi.HasValue)
                cmd.Parameters.AddWithValue("@aktifMi", aktifMi.Value);

            using var r = await cmd.ExecuteReaderAsync();

            while (await r.ReadAsync())
            {
                list.Add(new
                {
                    HatirlaticiID = Convert.ToInt32(r["HatirlaticiID"]),
                    KullaniciID = Convert.ToInt32(r["KullaniciID"]),
                    IlgiliMulkID = r["IlgiliMulkID"] == DBNull.Value ? null : (int?)r["IlgiliMulkID"],
                    IlgiliKiraSozlesmeID = r["IlgiliKiraSozlesmeID"] == DBNull.Value ? null : (int?)r["IlgiliKiraSozlesmeID"],
                    Baslik = r["Baslik"].ToString(),
                    Aciklama = r["Aciklama"] == DBNull.Value ? "" : r["Aciklama"].ToString(),
                    HatirlaticiTarihi = Convert.ToDateTime(r["HatirlaticiTarihi"]),
                    AktifMi = Convert.ToBoolean(r["AktifMi"]),
                    MulkBaslik = r["MulkBaslik"] == DBNull.Value ? null : r["MulkBaslik"].ToString(),
                    SozlesmeNo = r["SozlesmeNo"] == DBNull.Value ? null : r["SozlesmeNo"].ToString()
                });
            }

            return Ok(list);
        }

        // 2️⃣ YAKLAŞAN HATIRLATMALAR (Dashboard İçin)
        [HttpGet("yaklasan/{kullaniciId}")]
        public async Task<ActionResult<IEnumerable<object>>> GetYaklasan(int kullaniciId, int gunSayisi = 15)
        {
            var list = new List<object>();

            using var conn = Connection.GetConnection();
            await conn.OpenAsync();

            string sql = @"
                SELECT 
                    H.HatirlaticiID, H.Baslik, H.HatirlaticiTarihi,
                    DATEDIFF(day, GETDATE(), H.HatirlaticiTarihi) AS KalanGun,
                    M.Baslik AS MulkBaslik
                FROM Hatirlatici H
                LEFT JOIN Mulk M ON M.MulkID = H.IlgiliMulkID
                WHERE H.KullaniciID = @id
                AND H.AktifMi = 1
                AND H.HatirlaticiTarihi >= CAST(GETDATE() AS DATE) -- Geçmiştekileri getirme
                AND H.HatirlaticiTarihi <= DATEADD(day, @gunSayisi, GETDATE())
                ORDER BY H.HatirlaticiTarihi ASC";

            using var cmd = new SqlCommand(sql, conn);
            cmd.Parameters.AddWithValue("@id", kullaniciId);
            cmd.Parameters.AddWithValue("@gunSayisi", gunSayisi);

            using var r = await cmd.ExecuteReaderAsync();

            while (await r.ReadAsync())
            {
                list.Add(new
                {
                    HatirlaticiID = Convert.ToInt32(r["HatirlaticiID"]),
                    Baslik = r["Baslik"].ToString(),
                    HatirlaticiTarihi = Convert.ToDateTime(r["HatirlaticiTarihi"]).ToString("dd.MM.yyyy"),
                    KalanGun = Convert.ToInt32(r["KalanGun"]),
                    MulkBaslik = r["MulkBaslik"] == DBNull.Value ? "-" : r["MulkBaslik"].ToString()
                });
            }

            return Ok(list);
        }

        // 3️⃣ DETAY GETİR
        [HttpGet("{id}")]
        public async Task<ActionResult<Hatirlatici>> GetById(int id)
        {
            using var conn = Connection.GetConnection();
            await conn.OpenAsync();

            string sql = "SELECT * FROM Hatirlatici WHERE HatirlaticiID = @id";

            using var cmd = new SqlCommand(sql, conn);
            cmd.Parameters.AddWithValue("@id", id);

            using var r = await cmd.ExecuteReaderAsync();

            if (!await r.ReadAsync())
                return NotFound("Hatırlatıcı bulunamadı.");

            return Ok(new Hatirlatici
            {
                HatirlaticiID = Convert.ToInt32(r["HatirlaticiID"]),
                KullaniciID = Convert.ToInt32(r["KullaniciID"]),
                IlgiliMulkID = r["IlgiliMulkID"] == DBNull.Value ? null : (int?)r["IlgiliMulkID"],
                IlgiliKiraSozlesmeID = r["IlgiliKiraSozlesmeID"] == DBNull.Value ? null : (int?)r["IlgiliKiraSozlesmeID"],
                Baslik = r["Baslik"].ToString()!,
                Aciklama = r["Aciklama"] == DBNull.Value ? null : r["Aciklama"].ToString(),
                HatirlaticiTarihi = Convert.ToDateTime(r["HatirlaticiTarihi"]),
                AktifMi = Convert.ToBoolean(r["AktifMi"])
            });
        }

        // 4️⃣ YENİ HATIRLATICI OLUŞTUR
        [HttpPost]
        public async Task<ActionResult> Create(Hatirlatici model)
        {
            if (string.IsNullOrWhiteSpace(model.Baslik))
                return BadRequest("Başlık zorunludur.");

            using var conn = Connection.GetConnection();
            await conn.OpenAsync();

            string sql = @"INSERT INTO Hatirlatici 
                        (KullaniciID, IlgiliMulkID, IlgiliKiraSozlesmeID, Baslik, Aciklama, HatirlaticiTarihi, AktifMi)
                        OUTPUT INSERTED.HatirlaticiID
                        VALUES 
                        (@uid, @mulk, @sozlesme, @baslik, @aciklama, @tarih, 1)";

            using var cmd = new SqlCommand(sql, conn);
            cmd.Parameters.AddWithValue("@uid", model.KullaniciID);
            cmd.Parameters.AddWithValue("@mulk", (object?)model.IlgiliMulkID ?? DBNull.Value);
            cmd.Parameters.AddWithValue("@sozlesme", (object?)model.IlgiliKiraSozlesmeID ?? DBNull.Value);
            cmd.Parameters.AddWithValue("@baslik", model.Baslik);
            cmd.Parameters.AddWithValue("@aciklama", (object?)model.Aciklama ?? DBNull.Value);
            cmd.Parameters.AddWithValue("@tarih", model.HatirlaticiTarihi);

            int newId = (int)await cmd.ExecuteScalarAsync();

            await LogIslem(conn, model.KullaniciID, "INSERT", "Hatirlatici", newId.ToString(), $"Hatırlatıcı: {model.Baslik}");

            return Ok(new { Message = "Hatırlatıcı oluşturuldu.", ID = newId });
        }

        // 5️⃣ GÜNCELLE
        [HttpPut("{id}")]
        public async Task<ActionResult> Update(int id, Hatirlatici model)
        {
            using var conn = Connection.GetConnection();
            await conn.OpenAsync();

            string sql = @"UPDATE Hatirlatici SET
                        Baslik = @baslik,
                        Aciklama = @aciklama,
                        HatirlaticiTarihi = @tarih,
                        IlgiliMulkID = @mulk,
                        IlgiliKiraSozlesmeID = @sozlesme,
                        AktifMi = @aktif
                        WHERE HatirlaticiID = @id";

            using var cmd = new SqlCommand(sql, conn);
            cmd.Parameters.AddWithValue("@id", id);
            cmd.Parameters.AddWithValue("@baslik", model.Baslik);
            cmd.Parameters.AddWithValue("@aciklama", (object?)model.Aciklama ?? DBNull.Value);
            cmd.Parameters.AddWithValue("@tarih", model.HatirlaticiTarihi);
            cmd.Parameters.AddWithValue("@mulk", (object?)model.IlgiliMulkID ?? DBNull.Value);
            cmd.Parameters.AddWithValue("@sozlesme", (object?)model.IlgiliKiraSozlesmeID ?? DBNull.Value);
            cmd.Parameters.AddWithValue("@aktif", model.AktifMi);

            int affected = await cmd.ExecuteNonQueryAsync();

            if (affected == 0) return NotFound("Güncellenecek hatırlatıcı bulunamadı.");

            await LogIslem(conn, model.KullaniciID, "UPDATE", "Hatirlatici", id.ToString(), "Hatırlatıcı güncellendi.");

            return Ok("Hatırlatıcı güncellendi.");
        }

        // 6️⃣ SİL (Soft Delete - Pasife Çekme)
        [HttpDelete("{id}")]
        public async Task<ActionResult> Delete(int id)
        {
            using var conn = Connection.GetConnection();
            await conn.OpenAsync();

            // Önce kullanıcı ID'sini al (log için)
            int? userId = null;
            string selSql = "SELECT KullaniciID FROM Hatirlatici WHERE HatirlaticiID=@id";
            using (var selCmd = new SqlCommand(selSql, conn))
            {
                selCmd.Parameters.AddWithValue("@id", id);
                var res = await selCmd.ExecuteScalarAsync();
                if (res != null) userId = (int)res;
            }

            // Pasife çek
            string sql = "UPDATE Hatirlatici SET AktifMi = 0 WHERE HatirlaticiID = @id";

            using var cmd = new SqlCommand(sql, conn);
            cmd.Parameters.AddWithValue("@id", id);

            int affected = await cmd.ExecuteNonQueryAsync();

            if (affected == 0) return NotFound("Silinecek hatırlatıcı bulunamadı.");

            await LogIslem(conn, userId, "DELETE", "Hatirlatici", id.ToString(), "Hatırlatıcı silindi (Pasif).");

            return Ok("Hatırlatıcı silindi.");
        }
    }
}