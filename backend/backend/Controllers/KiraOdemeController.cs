using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using EmlakYonetimAPI.DbHelper;
using EmlakYonetimAPI.Models;
using System.Globalization;

namespace EmlakYonetimAPI.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class KiraOdemeController : ControllerBase
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
            catch { /* Log hatasý akýþý bozmasýn */ }
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
            catch { /* Bildirim hatasý akýþý bozmasýn */ }
        }

        private async Task<int> GetOdemeDurumID(SqlConnection conn, string durumAdi)
        {
            // Önce istenen durumu ara
            string sql = "SELECT OdemeDurumID FROM OdemeDurum WHERE DurumAdi = @DurumAdi";
            using var cmd = new SqlCommand(sql, conn);
            cmd.Parameters.AddWithValue("@DurumAdi", durumAdi);
            var result = await cmd.ExecuteScalarAsync();
            if (result != null) return (int)result;

            // Bulunamazsa 'Pending' ara
            if (durumAdi != "Pending")
            {
                cmd.Parameters["@DurumAdi"].Value = "Pending";
                result = await cmd.ExecuteScalarAsync();
                if (result != null) return (int)result;
            }

            return 1; // Hiçbiri yoksa varsayýlan (Genelde 1: Paid veya Pending)
        }

        private async Task KontrolVeGuncelleLate(SqlConnection conn, int odemeId, DateTime vadeTarihi, DateTime? odemeTarihi, int mevcutDurumId)
        {
            // Vade geçmiþ ve ödeme yapýlmamýþsa
            if (vadeTarihi < DateTime.Now && !odemeTarihi.HasValue)
            {
                int lateDurumId = await GetOdemeDurumID(conn, "Late");

                if (mevcutDurumId != lateDurumId)
                {
                    string updateSql = "UPDATE KiraOdeme SET OdemeDurumID = @DurumID WHERE KiraOdemeID = @OdemeID";
                    using var cmd = new SqlCommand(updateSql, conn);
                    cmd.Parameters.AddWithValue("@DurumID", lateDurumId);
                    cmd.Parameters.AddWithValue("@OdemeID", odemeId);
                    await cmd.ExecuteNonQueryAsync();

                    // Mülk Sahibini Bul ve Bildirim Gönder
                    int? ownerId = await GetOwnerIdByOdeme(conn, odemeId);
                    if (ownerId.HasValue)
                    {
                        await BildirimOlustur(conn, ownerId.Value, "Gecikmiþ Ödeme", $"Ödeme ID {odemeId} için vade tarihi geçti.");
                    }
                }
            }
        }

        private async Task<int?> GetOwnerIdByOdeme(SqlConnection conn, int odemeId)
        {
            string sql = @"SELECT M.SahipKullaniciID 
                           FROM KiraOdeme KO
                           INNER JOIN KiraSozlesme KS ON KS.KiraSozlesmeID = KO.KiraSozlesmeID
                           INNER JOIN Mulk M ON M.MulkID = KS.MulkID
                           WHERE KO.KiraOdemeID = @OdemeID";
            using var cmd = new SqlCommand(sql, conn);
            cmd.Parameters.AddWithValue("@OdemeID", odemeId);
            var res = await cmd.ExecuteScalarAsync();
            return res != null && res != DBNull.Value ? (int)res : null;
        }

        // --- API ENDPOINTS ---

        // 1?? TÜM ÖDEMELERÝ LÝSTELE
        [HttpGet]
        public async Task<ActionResult> GetAll()
        {
            var list = new List<object>();
            using var conn = Connection.GetConnection();
            await conn.OpenAsync();

            string sql = @"
                SELECT KO.*, PB.Kod AS ParaBirimi, OD.DurumAdi AS OdemeDurumu, 
                       OY.YontemAdi AS OdemeYontemi, KS.SozlesmeNo
                FROM KiraOdeme KO
                LEFT JOIN ParaBirimi PB ON PB.ParaBirimiID = KO.ParaBirimiID
                LEFT JOIN OdemeDurum OD ON OD.OdemeDurumID = KO.OdemeDurumID
                LEFT JOIN OdemeYontem OY ON OY.OdemeYontemID = KO.OdemeYontemID
                INNER JOIN KiraSozlesme KS ON KS.KiraSozlesmeID = KO.KiraSozlesmeID
                ORDER BY KO.VadeTarihi DESC";

            using var cmd = new SqlCommand(sql, conn);
            using var r = await cmd.ExecuteReaderAsync();
            while (await r.ReadAsync())
            {
                list.Add(MapToDto(r));
            }
            return Ok(list);
        }

        // 2?? MÜLK SAHÝBÝNE AÝT ÖDEMELER (FÝNANS SAYFASI ÝÇÝN)
        // Düzeltme: INNER JOIN yerine LEFT JOIN kullanýldý.
        [HttpGet("owner/{ownerId}")]
        public async Task<ActionResult> GetByOwner(int ownerId)
        {
            var list = new List<object>();
            using var conn = Connection.GetConnection();
            await conn.OpenAsync();

            string sql = @"
                SELECT 
                    KO.KiraOdemeID,
                    KO.VadeTarihi,
                    KO.OdemeTarihi,
                    KO.Tutar,
                    ISNULL(PB.Kod, 'TL') AS ParaBirimi,
                    ISNULL(OD.DurumAdi, 'Pending') AS Durum,
                    M.Baslik AS MulkBaslik,
                    KiraciUser.AdSoyad AS KiraciAd,
                    KS.SozlesmeNo
                FROM KiraOdeme KO
                INNER JOIN KiraSozlesme KS ON KS.KiraSozlesmeID = KO.KiraSozlesmeID
                INNER JOIN Mulk M ON M.MulkID = KS.MulkID
                INNER JOIN Kiraci K ON KS.KiraciID = K.KiraciID
                INNER JOIN Kullanici KiraciUser ON K.KullaniciID = KiraciUser.KullaniciID
                LEFT JOIN ParaBirimi PB ON KO.ParaBirimiID = PB.ParaBirimiID
                LEFT JOIN OdemeDurum OD ON KO.OdemeDurumID = OD.OdemeDurumID
                WHERE M.SahipKullaniciID = @id
                ORDER BY 
                    CASE WHEN OD.DurumAdi = 'Late' THEN 1 
                         WHEN OD.DurumAdi = 'Pending' THEN 2 
                         ELSE 3 END, 
                    KO.VadeTarihi ASC";

            using var cmd = new SqlCommand(sql, conn);
            cmd.Parameters.AddWithValue("@id", ownerId);

            using var r = await cmd.ExecuteReaderAsync();
            while (await r.ReadAsync())
            {
                list.Add(new
                {
                    KiraOdemeID = r["KiraOdemeID"],
                    VadeTarihi = Convert.ToDateTime(r["VadeTarihi"]).ToString("yyyy-MM-dd"),
                    OdemeTarihi = r["OdemeTarihi"] == DBNull.Value ? null : Convert.ToDateTime(r["OdemeTarihi"]).ToString("yyyy-MM-dd"),
                    Tutar = r["Tutar"],
                    ParaBirimi = r["ParaBirimi"].ToString(),
                    Durum = r["Durum"].ToString(),
                    Mulk = r["MulkBaslik"].ToString(),
                    Kiraci = r["KiraciAd"].ToString(),
                    SozlesmeNo = r["SozlesmeNo"].ToString()
                });
            }
            return Ok(list);
        }

        // 3?? BELÝRLÝ BÝR SÖZLEÞMEYE AÝT ÖDEMELER (KÝRACI ÝÇÝN)
        [HttpGet("sozlesme/{sozlesmeId}")]
        public async Task<ActionResult> GetBySozlesme(int sozlesmeId)
        {
            var list = new List<object>();
            using var conn = Connection.GetConnection();
            await conn.OpenAsync();

            string sql = @"
                SELECT KO.*, PB.Kod AS ParaBirimi, OD.DurumAdi AS OdemeDurumu, 
                       OY.YontemAdi AS OdemeYontemi, KS.SozlesmeNo
                FROM KiraOdeme KO
                LEFT JOIN ParaBirimi PB ON PB.ParaBirimiID = KO.ParaBirimiID
                LEFT JOIN OdemeDurum OD ON OD.OdemeDurumID = KO.OdemeDurumID
                LEFT JOIN OdemeYontem OY ON OY.OdemeYontemID = KO.OdemeYontemID
                INNER JOIN KiraSozlesme KS ON KS.KiraSozlesmeID = KO.KiraSozlesmeID
                WHERE KO.KiraSozlesmeID = @id
                ORDER BY KO.VadeTarihi ASC";

            using var cmd = new SqlCommand(sql, conn);
            cmd.Parameters.AddWithValue("@id", sozlesmeId);
            using var r = await cmd.ExecuteReaderAsync();
            while (await r.ReadAsync())
            {
                list.Add(MapToDto(r));
            }
            return Ok(list);
        }

        // 4?? GECÝKMÝÞ ÖDEMELER (LATE)
        [HttpGet("late")]
        public async Task<ActionResult> GetLatePayments()
        {
            var list = new List<object>();
            using var conn = Connection.GetConnection();
            await conn.OpenAsync();

            string sql = @"
                SELECT KO.KiraOdemeID, KO.VadeTarihi, KO.OdemeTarihi, KO.Tutar, OD.DurumAdi
                FROM KiraOdeme KO
                INNER JOIN OdemeDurum OD ON OD.OdemeDurumID = KO.OdemeDurumID
                WHERE OD.DurumAdi = 'Late'
                ORDER BY KO.VadeTarihi";

            using var cmd = new SqlCommand(sql, conn);
            using var r = await cmd.ExecuteReaderAsync();
            while (await r.ReadAsync())
            {
                list.Add(new
                {
                    KiraOdemeID = r.GetInt32(0),
                    VadeTarihi = r.GetDateTime(1),
                    OdemeTarihi = r.IsDBNull(2) ? (DateTime?)null : r.GetDateTime(2),
                    Tutar = r.GetDecimal(3),
                    Durum = r.GetString(4)
                });
            }
            return Ok(list);
        }

        // 5?? ÖDEME YAP (TAHSÝLAT)
        [HttpPut("pay/{id}")]
        public async Task<ActionResult> Pay(int id, [FromBody] PayOdemeRequest request)
        {
            if (!ModelState.IsValid || request == null) return BadRequest("Geçersiz veri.");

            using var conn = Connection.GetConnection();
            await conn.OpenAsync();

            // Mevcut veriyi al
            decimal tutar = 0;
            int? paraBirimiID = null;

            string selSql = "SELECT Tutar, ParaBirimiID FROM KiraOdeme WHERE KiraOdemeID=@id";
            using (var cmd = new SqlCommand(selSql, conn))
            {
                cmd.Parameters.AddWithValue("@id", id);
                using var r = await cmd.ExecuteReaderAsync();
                if (!await r.ReadAsync()) return NotFound("Ödeme bulunamadý.");
                tutar = r.GetDecimal(0);
                paraBirimiID = r.IsDBNull(1) ? null : r.GetInt32(1);
            }

            // Yeni tutarý belirle
            if (request.Tutar.HasValue && request.Tutar.Value > 0) tutar = request.Tutar.Value;
            else if (!string.IsNullOrWhiteSpace(request.TutarString))
            {
                // String temizleme (?, TL, boþluk vs.)
                string cleanVal = request.TutarString.Replace("?", "").Replace("TL", "").Trim().Replace(".", "").Replace(",", ".");
                if (decimal.TryParse(cleanVal, NumberStyles.Any, CultureInfo.InvariantCulture, out decimal pTutar)) tutar = pTutar;
            }

            DateTime odemeTarihi = request.OdemeTarihi ?? DateTime.Now;
            int paidStateId = await GetOdemeDurumID(conn, "Paid");
            int? finalParaBirimi = request.ParaBirimiID ?? paraBirimiID;

            // Güncelleme
            string updSql = @"UPDATE KiraOdeme SET 
                              OdemeTarihi=@ot, Tutar=@tut, OdemeDurumID=@stat, OdemeYontemID=@yontem, 
                              ParaBirimiID=@para, Aciklama=@acik 
                              WHERE KiraOdemeID=@id";

            using (var cmd = new SqlCommand(updSql, conn))
            {
                cmd.Parameters.AddWithValue("@id", id);
                cmd.Parameters.AddWithValue("@ot", odemeTarihi);
                cmd.Parameters.AddWithValue("@tut", tutar);
                cmd.Parameters.AddWithValue("@stat", paidStateId);
                cmd.Parameters.AddWithValue("@yontem", (object?)request.OdemeYontemID ?? DBNull.Value);
                cmd.Parameters.AddWithValue("@para", (object?)finalParaBirimi ?? DBNull.Value);
                cmd.Parameters.AddWithValue("@acik", (object?)request.Aciklama ?? DBNull.Value);
                await cmd.ExecuteNonQueryAsync();
            }

            // Log ve Bildirim
            int? ownerId = await GetOwnerIdByOdeme(conn, id);
            if (ownerId.HasValue)
            {
                await LogIslem(conn, ownerId, "PAY", "KiraOdeme", id.ToString(), $"Ödeme alýndý: {tutar}");
                await BildirimOlustur(conn, ownerId.Value, "Tahsilat", "Ödeme baþarýyla kaydedildi.");
            }

            return Ok(new { Message = "Tahsilat kaydedildi." });
        }

        // 6?? YENÝ ÖDEME PLANI OLUÞTUR (Create)
        [HttpPost]
        public async Task<ActionResult> Create([FromBody] KiraOdeme model)
        {
            if (model.Tutar <= 0) return BadRequest("Tutar 0'dan büyük olmalý.");

            using var conn = Connection.GetConnection();
            await conn.OpenAsync();

            // Durum Kontrolü
            int durumId = model.OdemeDurumID;
            if (model.OdemeTarihi.HasValue) durumId = await GetOdemeDurumID(conn, "Paid");
            else if (model.VadeTarihi < DateTime.Now) durumId = await GetOdemeDurumID(conn, "Late");
            else if (durumId <= 0) durumId = await GetOdemeDurumID(conn, "Pending");

            string sql = @"INSERT INTO KiraOdeme 
                           (KiraSozlesmeID, VadeTarihi, OdemeTarihi, Tutar, ParaBirimiID, OdemeDurumID, OdemeYontemID, Aciklama, OlusturmaTarihi)
                           OUTPUT INSERTED.KiraOdemeID
                           VALUES (@sid, @vade, @ot, @tut, @para, @stat, @yontem, @acik, GETDATE())";

            int newId;
            using (var cmd = new SqlCommand(sql, conn))
            {
                cmd.Parameters.AddWithValue("@sid", model.KiraSozlesmeID);
                cmd.Parameters.AddWithValue("@vade", model.VadeTarihi);
                cmd.Parameters.AddWithValue("@ot", (object?)model.OdemeTarihi ?? DBNull.Value);
                cmd.Parameters.AddWithValue("@tut", model.Tutar);

                // DÜZELTME BURADA:
                // Eðer ID 0 veya null gelirse DBNull.Value gönderiyoruz.
                // Veya varsayýlan olarak 1 (TRY) atayabilirsin: (object?)model.ParaBirimiID ?? 1;
                object paraBirimiVal = DBNull.Value;
                if (model.ParaBirimiID != null && model.ParaBirimiID > 0)
                {
                    paraBirimiVal = model.ParaBirimiID;
                }
                cmd.Parameters.AddWithValue("@para", paraBirimiVal);

                cmd.Parameters.AddWithValue("@stat", durumId);
                cmd.Parameters.AddWithValue("@yontem", (object?)model.OdemeYontemID ?? DBNull.Value);
                cmd.Parameters.AddWithValue("@acik", (object?)model.Aciklama ?? DBNull.Value);

                newId = (int)await cmd.ExecuteScalarAsync();
            }

            await KontrolVeGuncelleLate(conn, newId, model.VadeTarihi, model.OdemeTarihi, durumId);

            int? ownerId = await GetOwnerIdByOdeme(conn, newId);
            await LogIslem(conn, ownerId, "INSERT", "KiraOdeme", newId.ToString(), $"Plan oluþturuldu. Vade: {model.VadeTarihi:yyyy-MM-dd}");

            return Ok(new { Message = "Ödeme planý oluþturuldu.", ID = newId });
        }
        // 7?? UPDATE (Düzeltme)
        [HttpPut("{id}")]
        public async Task<ActionResult> Update(int id, [FromBody] KiraOdeme model)
        {
            if (model.Tutar <= 0) return BadRequest("Hatalý tutar.");

            using var conn = Connection.GetConnection();
            await conn.OpenAsync();

            // Durum hesapla
            int durumId = model.OdemeDurumID;
            if (model.OdemeTarihi.HasValue) durumId = await GetOdemeDurumID(conn, "Paid");
            else if (model.VadeTarihi < DateTime.Now) durumId = await GetOdemeDurumID(conn, "Late");

            string sql = @"UPDATE KiraOdeme SET 
                           VadeTarihi=@vade, OdemeTarihi=@ot, Tutar=@tut, ParaBirimiID=@para, 
                           OdemeDurumID=@stat, OdemeYontemID=@yontem, Aciklama=@acik
                           WHERE KiraOdemeID=@id";

            using (var cmd = new SqlCommand(sql, conn))
            {
                cmd.Parameters.AddWithValue("@id", id);
                cmd.Parameters.AddWithValue("@vade", model.VadeTarihi);
                cmd.Parameters.AddWithValue("@ot", (object?)model.OdemeTarihi ?? DBNull.Value);
                cmd.Parameters.AddWithValue("@tut", model.Tutar);
                cmd.Parameters.AddWithValue("@para", (object?)model.ParaBirimiID ?? DBNull.Value);
                cmd.Parameters.AddWithValue("@stat", durumId);
                cmd.Parameters.AddWithValue("@yontem", (object?)model.OdemeYontemID ?? DBNull.Value);
                cmd.Parameters.AddWithValue("@acik", (object?)model.Aciklama ?? DBNull.Value);

                int aff = await cmd.ExecuteNonQueryAsync();
                if (aff == 0) return NotFound("Kayýt yok.");
            }

            await KontrolVeGuncelleLate(conn, id, model.VadeTarihi, model.OdemeTarihi, durumId);

            int? ownerId = await GetOwnerIdByOdeme(conn, id);
            await LogIslem(conn, ownerId, "UPDATE", "KiraOdeme", id.ToString(), "Kayýt güncellendi.");

            return Ok(new { Message = "Güncellendi." });
        }

        // 8?? DELETE
        [HttpDelete("{id}")]
        public async Task<ActionResult> Delete(int id)
        {
            using var conn = Connection.GetConnection();
            await conn.OpenAsync();

            int? ownerId = await GetOwnerIdByOdeme(conn, id);

            string sql = "DELETE FROM KiraOdeme WHERE KiraOdemeID=@id";
            using (var cmd = new SqlCommand(sql, conn))
            {
                cmd.Parameters.AddWithValue("@id", id);
                int aff = await cmd.ExecuteNonQueryAsync();
                if (aff == 0) return NotFound("Silinecek kayýt bulunamadý.");
            }

            await LogIslem(conn, ownerId, "DELETE", "KiraOdeme", id.ToString(), "Ödeme kaydý silindi.");
            return Ok(new { Message = "Silindi." });
        }

        // --- MAPPING HELPER ---
        private object MapToDto(SqlDataReader r)
        {
            return new
            {
                KiraOdemeID = r["KiraOdemeID"],
                KiraSozlesmeID = r["KiraSozlesmeID"],
                VadeTarihi = r["VadeTarihi"],
                OdemeTarihi = r["OdemeTarihi"] == DBNull.Value ? null : r["OdemeTarihi"],
                Tutar = r["Tutar"],
                ParaBirimiID = r["ParaBirimiID"] == DBNull.Value ? null : r["ParaBirimiID"],
                ParaBirimi = r["ParaBirimi"] == DBNull.Value ? "TL" : r["ParaBirimi"],
                OdemeDurumID = r["OdemeDurumID"],
                OdemeDurumu = r["OdemeDurumu"] == DBNull.Value ? "Pending" : r["OdemeDurumu"],
                OdemeYontemID = r["OdemeYontemID"] == DBNull.Value ? null : r["OdemeYontemID"],
                OdemeYontemi = r["OdemeYontemi"] == DBNull.Value ? null : r["OdemeYontemi"],
                Aciklama = r["Aciklama"] == DBNull.Value ? null : r["Aciklama"],
                OlusturmaTarihi = r["OlusturmaTarihi"],
                SozlesmeNo = r["SozlesmeNo"]
            };
        }
    }

    // DTO Sýnýfý
    public class PayOdemeRequest
    {
        public decimal? Tutar { get; set; }
        public string? TutarString { get; set; } // "15.000 TL" gibi gelebilir
        public string? Aciklama { get; set; }
        public int? OdemeYontemID { get; set; }
        public DateTime? OdemeTarihi { get; set; }
        public int? ParaBirimiID { get; set; }
    }
}