using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using EmlakYonetimAPI.DbHelper;
using EmlakYonetimAPI.Models;

namespace EmlakYonetimAPI.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class KiraSozlesmeController : ControllerBase
    {
      

        private async Task LogIslem(SqlConnection conn, int? kullaniciId, string islemTuru, string tabloAdi, string kayitId, string? detay = null)
        {
            try
            {
                string logSql = @"INSERT INTO Logkayit (KullaniciID, IslemTarihi, IslemTuru, TabloAdi, KayitID, Detay) VALUES (@KullaniciID, GETDATE(), @IslemTuru, @TabloAdi, @KayitID, @Detay)";
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
                string sql = @"INSERT INTO Bildirim (KullaniciID, Baslik, Mesaj, OlusturmaTarihi, OkunduMu) VALUES (@KullaniciID, @Baslik, @Mesaj, GETDATE(), 0)";
                using var cmd = new SqlCommand(sql, conn);
                cmd.Parameters.AddWithValue("@KullaniciID", kullaniciId);
                cmd.Parameters.AddWithValue("@Baslik", baslik);
                cmd.Parameters.AddWithValue("@Mesaj", mesaj);
                await cmd.ExecuteNonQueryAsync();
            }
            catch { /* Bildirim hatasý akýþý bozmasýn */ }
        }

        private async Task<bool> TarihCakismasiVar(SqlConnection conn, int mulkId, DateTime baslangic, DateTime? bitis, int? mevcutSozlesmeId = null)
        {
            string sql = @"
                SELECT COUNT(*) FROM KiraSozlesme
                WHERE MulkID = @MulkID AND AktifMi = 1
                AND (@mevcutId IS NULL OR KiraSozlesmeID != @mevcutId)
                AND (
                    (@Baslangic BETWEEN BaslangicTarihi AND ISNULL(BitisTarihi, '9999-12-31')) OR
                    (@Bitis IS NOT NULL AND @Bitis BETWEEN BaslangicTarihi AND ISNULL(BitisTarihi, '9999-12-31')) OR
                    (BaslangicTarihi BETWEEN @Baslangic AND ISNULL(@Bitis, '9999-12-31'))
                )";
            using var cmd = new SqlCommand(sql, conn);
            cmd.Parameters.AddWithValue("@MulkID", mulkId);
            cmd.Parameters.AddWithValue("@Baslangic", baslangic);
            cmd.Parameters.AddWithValue("@Bitis", (object?)bitis ?? DBNull.Value);
            cmd.Parameters.AddWithValue("@mevcutId", (object?)mevcutSozlesmeId ?? DBNull.Value);
            return (int)await cmd.ExecuteScalarAsync() > 0;
        }

       
        [HttpGet]
        public async Task<ActionResult<IEnumerable<SozlesmeDetayDto>>> GetAll(int userId, string role)
        {
            var list = new List<SozlesmeDetayDto>();
            using var conn = Connection.GetConnection();
            await conn.OpenAsync();

            string sql = "";

            if (role == "Owner")
            {
                
                sql = @"
                    SELECT KS.*, M.Baslik AS MulkBaslik, M.Adres AS MulkAdres, 
                           KiraciUser.AdSoyad AS KiraciAd, PB.Kod AS ParaBirimiKod,
                           OwnerUser.AdSoyad AS SahipAd
                    FROM KiraSozlesme KS
                    INNER JOIN Mulk M ON KS.MulkID = M.MulkID
                    INNER JOIN Kiraci K ON KS.KiraciID = K.KiraciID
                    INNER JOIN Kullanici KiraciUser ON K.KullaniciID = KiraciUser.KullaniciID
                    INNER JOIN ParaBirimi PB ON KS.ParaBirimiID = PB.ParaBirimiID
                    INNER JOIN Kullanici OwnerUser ON M.SahipKullaniciID = OwnerUser.KullaniciID
                    WHERE M.SahipKullaniciID = @UserId
                    ORDER BY KS.AktifMi DESC, KS.BaslangicTarihi DESC";
            }
            else if (role == "Tenant")
            {
                
                sql = @"
                    SELECT KS.*, M.Baslik AS MulkBaslik, M.Adres AS MulkAdres, 
                           KiraciUser.AdSoyad AS KiraciAd, PB.Kod AS ParaBirimiKod,
                           OwnerUser.AdSoyad AS SahipAd
                    FROM KiraSozlesme KS
                    INNER JOIN Mulk M ON KS.MulkID = M.MulkID
                    INNER JOIN Kiraci K ON KS.KiraciID = K.KiraciID
                    INNER JOIN Kullanici KiraciUser ON K.KullaniciID = KiraciUser.KullaniciID
                    INNER JOIN ParaBirimi PB ON KS.ParaBirimiID = PB.ParaBirimiID
                    INNER JOIN Kullanici OwnerUser ON M.SahipKullaniciID = OwnerUser.KullaniciID
                    WHERE K.KullaniciID = @UserId
                    ORDER BY KS.AktifMi DESC";
            }
            else if (role == "Admin")
            {
               
                sql = @"
                    SELECT KS.*, M.Baslik AS MulkBaslik, M.Adres AS MulkAdres, 
                           KiraciUser.AdSoyad AS KiraciAd, PB.Kod AS ParaBirimiKod,
                           OwnerUser.AdSoyad AS SahipAd
                    FROM KiraSozlesme KS
                    INNER JOIN Mulk M ON KS.MulkID = M.MulkID
                    INNER JOIN Kiraci K ON KS.KiraciID = K.KiraciID
                    INNER JOIN Kullanici KiraciUser ON K.KullaniciID = KiraciUser.KullaniciID
                    INNER JOIN ParaBirimi PB ON KS.ParaBirimiID = PB.ParaBirimiID
                    INNER JOIN Kullanici OwnerUser ON M.SahipKullaniciID = OwnerUser.KullaniciID
                    ORDER BY KS.AktifMi DESC, KS.BaslangicTarihi DESC";
            }
            else
            {
                return BadRequest("Geçersiz rol. 'Owner', 'Tenant' veya 'Admin' gönderilmelidir.");
            }

            using var cmd = new SqlCommand(sql, conn);
            if (role != "Admin")
            {
                cmd.Parameters.AddWithValue("@UserId", userId);
            }

            using var reader = await cmd.ExecuteReaderAsync();
            while (await reader.ReadAsync())
            {
                list.Add(new SozlesmeDetayDto
                {
                    KiraSozlesmeID = Convert.ToInt32(reader["KiraSozlesmeID"]),
                    SozlesmeNo = reader["SozlesmeNo"] == DBNull.Value ? "" : reader["SozlesmeNo"].ToString(),
                    MulkID = Convert.ToInt32(reader["MulkID"]),
                    MulkBaslik = reader["MulkBaslik"].ToString(),
                    MulkAdres = reader["MulkAdres"].ToString(),
                    MulkSahibiAd = reader["SahipAd"].ToString(),
                    KiraciID = Convert.ToInt32(reader["KiraciID"]),
                    KiraciAdSoyad = reader["KiraciAd"].ToString(),
                    AylikKiraTutar = Convert.ToDecimal(reader["AylikKiraTutar"]),
                    ParaBirimiKod = reader["ParaBirimiKod"].ToString(),
                    ParaBirimiID = Convert.ToInt32(reader["ParaBirimiID"]),
                    OdemeGunu = Convert.ToByte(reader["OdemeGunu"]),
                    BaslangicTarihi = Convert.ToDateTime(reader["BaslangicTarihi"]),
                    BitisTarihi = reader["BitisTarihi"] == DBNull.Value ? null : Convert.ToDateTime(reader["BitisTarihi"]),
                    AktifMi = Convert.ToBoolean(reader["AktifMi"]),
                    DepozitoTutar = reader["DepozitoTutar"] == DBNull.Value ? null : Convert.ToDecimal(reader["DepozitoTutar"]),
                    Aciklama = reader["Aciklama"] == DBNull.Value ? null : reader["Aciklama"].ToString()
                });
            }

            return Ok(list);
        }

        
        [HttpPost]
        public async Task<ActionResult> Create([FromBody] KiraSozlesme model)
        {
            if (model == null) return BadRequest("Model boþ.");

           
            if (model.AylikKiraTutar <= 0) return BadRequest("Kira tutarý 0'dan büyük olmalý.");
            if (model.OdemeGunu < 1 || model.OdemeGunu > 31) return BadRequest("Ödeme günü 1-31 arasýnda olmalý.");

            using var conn = Connection.GetConnection();
            await conn.OpenAsync();

           
            if (await TarihCakismasiVar(conn, model.MulkID, model.BaslangicTarihi, model.BitisTarihi))
                return BadRequest("Bu mülkte, bu tarihlerde zaten aktif bir sözleþme var.");

            int? sahipId = null;
            string sahipSql = "SELECT SahipKullaniciID FROM Mulk WHERE MulkID = @MulkID";
            using (var cmdSahip = new SqlCommand(sahipSql, conn))
            {
                cmdSahip.Parameters.AddWithValue("@MulkID", model.MulkID);
                var result = await cmdSahip.ExecuteScalarAsync();
                if (result != DBNull.Value) sahipId = Convert.ToInt32(result);
            }

            using var trans = conn.BeginTransaction();
            try
            {
               
                string sql = @"
                    INSERT INTO KiraSozlesme 
                    (MulkID, KiraciID, SozlesmeNo, BaslangicTarihi, BitisTarihi, AylikKiraTutar, ParaBirimiID, DepozitoTutar, OdemeGunu, AktifMi, Aciklama, OlusturmaTarihi)
                    OUTPUT INSERTED.KiraSozlesmeID
                    VALUES 
                    (@MulkID, @KiraciID, @SozlesmeNo, @Bas, @Bit, @Tutar, @Para, @Dep, @Gun, 1, @Aciklama, GETDATE())";

                int yeniId;
                using (var cmd = new SqlCommand(sql, conn, trans))
                {
                    cmd.Parameters.AddWithValue("@MulkID", model.MulkID);
                    cmd.Parameters.AddWithValue("@KiraciID", model.KiraciID);
            
                    cmd.Parameters.AddWithValue("@SozlesmeNo", Guid.NewGuid().ToString().Substring(0, 8).ToUpper());
                    cmd.Parameters.AddWithValue("@Bas", model.BaslangicTarihi);
                    cmd.Parameters.AddWithValue("@Bit", (object?)model.BitisTarihi ?? DBNull.Value);
                    cmd.Parameters.AddWithValue("@Tutar", model.AylikKiraTutar);
                    cmd.Parameters.AddWithValue("@Para", model.ParaBirimiID);
                    cmd.Parameters.AddWithValue("@Dep", (object?)model.DepozitoTutar ?? DBNull.Value);
                    cmd.Parameters.AddWithValue("@Gun", model.OdemeGunu);
                    cmd.Parameters.AddWithValue("@Aciklama", (object?)model.Aciklama ?? DBNull.Value);
                    yeniId = (int)await cmd.ExecuteScalarAsync();
                }

               
                string sqlOdeme = @"
                    INSERT INTO KiraOdeme (KiraSozlesmeID, VadeTarihi, Tutar, ParaBirimiID, OdemeDurumID, OlusturmaTarihi)
                    VALUES (@SozlesmeID, @Vade, @Tutar, @Para, 3, GETDATE())"; // 3 = Pending ID varsayýmý

                using (var cmdOdeme = new SqlCommand(sqlOdeme, conn, trans))
                {
                    DateTime ilkVade = new DateTime(model.BaslangicTarihi.Year, model.BaslangicTarihi.Month, model.OdemeGunu);

                    cmdOdeme.Parameters.AddWithValue("@SozlesmeID", yeniId);
                    cmdOdeme.Parameters.AddWithValue("@Vade", ilkVade);
                    cmdOdeme.Parameters.AddWithValue("@Tutar", model.AylikKiraTutar);
                    cmdOdeme.Parameters.AddWithValue("@Para", model.ParaBirimiID);
                    await cmdOdeme.ExecuteNonQueryAsync();
                }


                trans.Commit();

                if (sahipId.HasValue)
                {
                    await LogIslem(conn, sahipId, "INSERT", "KiraSozlesme", yeniId.ToString(), $"Yeni sözleþme. Tutar: {model.AylikKiraTutar}");
                    await BildirimOlustur(conn, sahipId.Value, "Sözleþme Oluþturuldu", $"{model.MulkID} nolu mülk için sözleþme aktif edildi.");
                }

                return Ok(new { Message = "Sözleþme baþarýyla oluþturuldu.", SozlesmeID = yeniId });
            }
            catch (Exception ex)
            {
                trans.Rollback();
                return BadRequest("Hata oluþtu: " + ex.Message);
            }
        }


        [HttpDelete("{id}")]
        public async Task<ActionResult> Delete(int id)
        {
            using var conn = Connection.GetConnection();
            await conn.OpenAsync();

            string sql = "UPDATE KiraSozlesme SET AktifMi = 0 WHERE KiraSozlesmeID = @id";
            using var cmd = new SqlCommand(sql, conn);
            cmd.Parameters.AddWithValue("@id", id);

            int affected = await cmd.ExecuteNonQueryAsync();
            if (affected > 0) return Ok(new { Message = "Sözleþme pasife alýndý." });
            return NotFound("Sözleþme bulunamadý.");
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<SozlesmeDetayDto>> GetById(int id)
        {
            using var conn = Connection.GetConnection();
            await conn.OpenAsync();

            string sql = @"
                SELECT KS.*, M.Baslik AS MulkBaslik, M.Adres AS MulkAdres, 
                       KiraciUser.AdSoyad AS KiraciAd, PB.Kod AS ParaBirimiKod,
                       OwnerUser.AdSoyad AS SahipAd
                FROM KiraSozlesme KS
                INNER JOIN Mulk M ON KS.MulkID = M.MulkID
                INNER JOIN Kiraci K ON KS.KiraciID = K.KiraciID
                INNER JOIN Kullanici KiraciUser ON K.KullaniciID = KiraciUser.KullaniciID
                INNER JOIN ParaBirimi PB ON KS.ParaBirimiID = PB.ParaBirimiID
                INNER JOIN Kullanici OwnerUser ON M.SahipKullaniciID = OwnerUser.KullaniciID
                WHERE KS.KiraSozlesmeID = @id";

            using var cmd = new SqlCommand(sql, conn);
            cmd.Parameters.AddWithValue("@id", id);
            using var reader = await cmd.ExecuteReaderAsync();

            if (await reader.ReadAsync())
            {
                var dto = new SozlesmeDetayDto
                {
                    KiraSozlesmeID = Convert.ToInt32(reader["KiraSozlesmeID"]),
                    SozlesmeNo = reader["SozlesmeNo"] == DBNull.Value ? "" : reader["SozlesmeNo"].ToString(),
                    MulkID = Convert.ToInt32(reader["MulkID"]),
                    MulkBaslik = reader["MulkBaslik"].ToString(),
                    MulkAdres = reader["MulkAdres"].ToString(),
                    MulkSahibiAd = reader["SahipAd"].ToString(),
                    KiraciID = Convert.ToInt32(reader["KiraciID"]),
                    KiraciAdSoyad = reader["KiraciAd"].ToString(),
                    AylikKiraTutar = Convert.ToDecimal(reader["AylikKiraTutar"]),
                    ParaBirimiKod = reader["ParaBirimiKod"].ToString(),
                    ParaBirimiID = Convert.ToInt32(reader["ParaBirimiID"]),
                    OdemeGunu = Convert.ToByte(reader["OdemeGunu"]),
                    BaslangicTarihi = Convert.ToDateTime(reader["BaslangicTarihi"]),
                    BitisTarihi = reader["BitisTarihi"] == DBNull.Value ? null : Convert.ToDateTime(reader["BitisTarihi"]),
                    AktifMi = Convert.ToBoolean(reader["AktifMi"]),
                    DepozitoTutar = reader["DepozitoTutar"] == DBNull.Value ? null : Convert.ToDecimal(reader["DepozitoTutar"]),
                    Aciklama = reader["Aciklama"] == DBNull.Value ? null : reader["Aciklama"].ToString()
                };
                return Ok(dto);
            }

            return NotFound("Sözleþme bulunamadý.");
        }


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
                    PB.Kod AS ParaBirimi,
                    OD.DurumAdi AS Durum,
                    M.Baslik AS MulkBaslik,
                    KiraciUser.AdSoyad AS KiraciAd,
                    KS.SozlesmeNo
                FROM KiraOdeme KO
                INNER JOIN KiraSozlesme KS ON KS.KiraSozlesmeID = KO.KiraSozlesmeID
                INNER JOIN Mulk M ON M.MulkID = KS.MulkID
                INNER JOIN Kiraci K ON KS.KiraciID = K.KiraciID
                INNER JOIN Kullanici KiraciUser ON K.KullaniciID = KiraciUser.KullaniciID
                LEFT JOIN ParaBirimi PB ON KO.ParaBirimiID = PB.ParaBirimiID
                INNER JOIN OdemeDurum OD ON KO.OdemeDurumID = OD.OdemeDurumID
                WHERE M.SahipKullaniciID = @id
                ORDER BY 
                    CASE WHEN OD.DurumAdi = 'Late' THEN 1 
                         WHEN OD.DurumAdi = 'Pending' THEN 2 
                         ELSE 3 END, -- Önce Gecikenler, Sonra Bekleyenler
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

        [HttpPut("{id}")]
        public async Task<ActionResult> Update(int id, [FromBody] KiraSozlesme model)
        {
            if (model == null) return BadRequest("Veri yok.");

            using var conn = Connection.GetConnection();
            await conn.OpenAsync();


            string checkSql = "SELECT COUNT(*) FROM KiraSozlesme WHERE KiraSozlesmeID = @id";
            using (var checkCmd = new SqlCommand(checkSql, conn))
            {
                checkCmd.Parameters.AddWithValue("@id", id);
                if ((int)await checkCmd.ExecuteScalarAsync() == 0)
                    return NotFound("Sözleþme bulunamadý.");
            }


            if (await TarihCakismasiVar(conn, model.MulkID, model.BaslangicTarihi, model.BitisTarihi, id))
                return BadRequest("Bu mülkte, bu tarihlerde zaten aktif bir sözleþme var.");


            if (model.OdemeGunu < 1 || model.OdemeGunu > 31)
                return BadRequest("Ödeme günü 1-31 arasýnda olmalýdýr.");


            int? sahipId = null;
            string sahipSql = "SELECT SahipKullaniciID FROM Mulk WHERE MulkID = @MulkID";
            using (var cmdSahip = new SqlCommand(sahipSql, conn))
            {
                cmdSahip.Parameters.AddWithValue("@MulkID", model.MulkID);
                var result = await cmdSahip.ExecuteScalarAsync();
                if (result != DBNull.Value) sahipId = Convert.ToInt32(result);
            }

            using var trans = conn.BeginTransaction();
            try
            {
                string sql = @"
                    UPDATE KiraSozlesme SET
                        MulkID = @MulkID,
                        KiraciID = @KiraciID,
                        BaslangicTarihi = @Bas,
                        BitisTarihi = @Bit,
                        AylikKiraTutar = @Tutar,
                        ParaBirimiID = @Para,
                        DepozitoTutar = @Dep,
                        OdemeGunu = @Gun,
                        AktifMi = @AktifMi,
                        Aciklama = @Aciklama
                    WHERE KiraSozlesmeID = @id";

                using var cmd = new SqlCommand(sql, conn, trans);
                cmd.Parameters.AddWithValue("@id", id);
                cmd.Parameters.AddWithValue("@MulkID", model.MulkID);
                cmd.Parameters.AddWithValue("@KiraciID", model.KiraciID);
                cmd.Parameters.AddWithValue("@Bas", model.BaslangicTarihi);
                cmd.Parameters.AddWithValue("@Bit", (object?)model.BitisTarihi ?? DBNull.Value);
                cmd.Parameters.AddWithValue("@Tutar", model.AylikKiraTutar);
                cmd.Parameters.AddWithValue("@Para", model.ParaBirimiID);
                cmd.Parameters.AddWithValue("@Dep", (object?)model.DepozitoTutar ?? DBNull.Value);
                cmd.Parameters.AddWithValue("@Gun", model.OdemeGunu);
                cmd.Parameters.AddWithValue("@AktifMi", model.AktifMi);
                cmd.Parameters.AddWithValue("@Aciklama", (object?)model.Aciklama ?? DBNull.Value);

                await cmd.ExecuteNonQueryAsync();

                await LogIslem(conn, sahipId, "UPDATE", "KiraSozlesme", id.ToString(), $"Sözleþme güncellendi: {id}");

                trans.Commit();
                return Ok(new { Message = "Sözleþme güncellendi." });
            }
            catch (Exception ex)
            {
                trans.Rollback();
                return StatusCode(500, new { Message = "Sözleþme güncellenirken hata oluþtu: " + ex.Message });
            }
        }

    }
}
