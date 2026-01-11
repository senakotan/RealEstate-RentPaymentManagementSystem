using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using EmlakYonetimAPI.DbHelper;
using EmlakYonetimAPI.Models;
using System.Data;

namespace EmlakYonetimAPI.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class DashboardController : ControllerBase
    {
        [HttpGet("owner/{ownerId}")]
        public async Task<IActionResult> GetOwnerDashboard(int ownerId)
        {
            var result = new Dictionary<string, object>();

            using var conn = Connection.GetConnection();
            await conn.OpenAsync();

            string sql = @"
                -- 1. GENEL SAYAÇLAR
                SELECT 
                    (SELECT COUNT(*) FROM Mulk WHERE SahipKullaniciID = @id) AS MulkSayisi,
                    (SELECT COUNT(*) FROM KiraSozlesme KS INNER JOIN Mulk M ON M.MulkID = KS.MulkID WHERE M.SahipKullaniciID = @id AND KS.AktifMi = 1) AS AktifSozlesme,
                    (SELECT COUNT(*) FROM KiraOdeme KO INNER JOIN KiraSozlesme KS ON KS.KiraSozlesmeID = KO.KiraSozlesmeID INNER JOIN Mulk M ON M.MulkID = KS.MulkID INNER JOIN OdemeDurum OD ON KO.OdemeDurumID = OD.OdemeDurumID WHERE M.SahipKullaniciID = @id AND OD.DurumAdi = 'Late') AS GecikmisSayisi;

                -- 2. BU AY YAPILAN TAHSİLATLAR (Para Birimine Göre Gruplu)
                SELECT PB.Kod, SUM(KO.Tutar) AS Toplam
                FROM KiraOdeme KO
                INNER JOIN KiraSozlesme KS ON KS.KiraSozlesmeID = KO.KiraSozlesmeID
                INNER JOIN Mulk M ON M.MulkID = KS.MulkID
                INNER JOIN ParaBirimi PB ON KO.ParaBirimiID = PB.ParaBirimiID
                INNER JOIN OdemeDurum OD ON KO.OdemeDurumID = OD.OdemeDurumID
                WHERE M.SahipKullaniciID = @id 
                  AND OD.DurumAdi = 'Paid' 
                  AND MONTH(KO.OdemeTarihi) = MONTH(GETDATE()) 
                  AND YEAR(KO.OdemeTarihi) = YEAR(GETDATE())
                GROUP BY PB.Kod;

                -- 3. SON İŞLEMLER (Detaylı)
                SELECT TOP(5)
                    KO.VadeTarihi, 
                    KO.OdemeTarihi, 
                    KO.Tutar, 
                    PB.Kod AS ParaBirimi,
                    OD.DurumAdi,
                    KiraciUser.AdSoyad AS Kiraci,
                    M.Baslik AS Mulk
                FROM KiraOdeme KO
                INNER JOIN KiraSozlesme KS ON KS.KiraSozlesmeID = KO.KiraSozlesmeID
                INNER JOIN Mulk M ON M.MulkID = KS.MulkID
                INNER JOIN Kiraci K ON KS.KiraciID = K.KiraciID
                INNER JOIN Kullanici KiraciUser ON K.KullaniciID = KiraciUser.KullaniciID
                INNER JOIN ParaBirimi PB ON KO.ParaBirimiID = PB.ParaBirimiID
                INNER JOIN OdemeDurum OD ON KO.OdemeDurumID = OD.OdemeDurumID
                WHERE M.SahipKullaniciID = @id
                ORDER BY KO.OlusturmaTarihi DESC; -- En son eklenen/güncellenen en üstte
            ";

            using var cmd = new SqlCommand(sql, conn);
            cmd.Parameters.AddWithValue("@id", ownerId);

            using var reader = await cmd.ExecuteReaderAsync();

            if (await reader.ReadAsync())
            {
                result["MulkSayisi"] = reader["MulkSayisi"];
                result["AktifSozlesme"] = reader["AktifSozlesme"];
                result["GecikmisOdeme"] = reader["GecikmisSayisi"];
            }


            await reader.NextResultAsync();
            var gelirler = new List<object>();
            while (await reader.ReadAsync())
            {
                gelirler.Add(new
                {
                    ParaBirimi = reader["Kod"].ToString(),
                    Toplam = reader["Toplam"]
                });
            }
            result["BuAyGelir"] = gelirler;


            await reader.NextResultAsync();
            var sonHareketler = new List<object>();
            while (await reader.ReadAsync())
            {
                sonHareketler.Add(new
                {
                    VadeTarihi = Convert.ToDateTime(reader["VadeTarihi"]).ToString("dd.MM.yyyy"),
                    OdemeTarihi = reader["OdemeTarihi"] == DBNull.Value ? "-" : Convert.ToDateTime(reader["OdemeTarihi"]).ToString("dd.MM.yyyy"),
                    Tutar = reader["Tutar"],
                    ParaBirimi = reader["ParaBirimi"].ToString(),
                    Durum = reader["DurumAdi"].ToString(),
                    Kiraci = reader["Kiraci"].ToString(),
                    Mulk = reader["Mulk"].ToString()
                });
            }
            result["SonHareketler"] = sonHareketler;

            return Ok(result);
        }

        // Admin Dashboard
        [HttpGet("admin")]
        public async Task<IActionResult> GetAdminDashboard()
        {
            var result = new Dictionary<string, object>();

            using var conn = Connection.GetConnection();
            await conn.OpenAsync();

            string sql = @"
                -- 1. GENEL SAYAÇLAR
                SELECT 
                    (SELECT COUNT(*) FROM Kullanici WHERE AktifMi = 1) AS ToplamKullanici,
                    (SELECT COUNT(*) FROM Mulk WHERE AktifMi = 1) AS ToplamMulk,
                    (SELECT COUNT(*) FROM KiraSozlesme WHERE AktifMi = 1) AS AktifSozlesme,
                    (SELECT COUNT(*) FROM KiraOdeme KO 
                     INNER JOIN OdemeDurum OD ON KO.OdemeDurumID = OD.OdemeDurumID 
                     WHERE OD.DurumAdi = 'Late') AS GecikmisOdeme;

                -- 2. BU AY YAPILAN TAHSİLATLAR (Para Birimine Göre Gruplu)
                SELECT PB.Kod, SUM(KO.Tutar) AS Toplam
                FROM KiraOdeme KO
                INNER JOIN ParaBirimi PB ON KO.ParaBirimiID = PB.ParaBirimiID
                INNER JOIN OdemeDurum OD ON KO.OdemeDurumID = OD.OdemeDurumID
                WHERE OD.DurumAdi = 'Paid' 
                  AND MONTH(KO.OdemeTarihi) = MONTH(GETDATE()) 
                  AND YEAR(KO.OdemeTarihi) = YEAR(GETDATE())
                GROUP BY PB.Kod;

                -- 3. SON 5 İŞLEM (Ödemeler)
                SELECT TOP(5)
                    KO.VadeTarihi, 
                    KO.OdemeTarihi, 
                    KO.Tutar, 
                    PB.Kod AS ParaBirimi,
                    OD.DurumAdi,
                    KiraciUser.AdSoyad AS Kiraci,
                    M.Baslik AS Mulk
                FROM KiraOdeme KO
                INNER JOIN KiraSozlesme KS ON KS.KiraSozlesmeID = KO.KiraSozlesmeID
                INNER JOIN Mulk M ON M.MulkID = KS.MulkID
                INNER JOIN Kiraci K ON KS.KiraciID = K.KiraciID
                INNER JOIN Kullanici KiraciUser ON K.KullaniciID = KiraciUser.KullaniciID
                INNER JOIN ParaBirimi PB ON KO.ParaBirimiID = PB.ParaBirimiID
                INNER JOIN OdemeDurum OD ON KO.OdemeDurumID = OD.OdemeDurumID
                ORDER BY KO.OlusturmaTarihi DESC;
            ";

            using var cmd = new SqlCommand(sql, conn);
            using var reader = await cmd.ExecuteReaderAsync();


            if (await reader.ReadAsync())
            {
                result["ToplamKullanici"] = reader["ToplamKullanici"];
                result["ToplamMulk"] = reader["ToplamMulk"];
                result["AktifSozlesme"] = reader["AktifSozlesme"];
                result["GecikmisOdeme"] = reader["GecikmisOdeme"];
            }


            await reader.NextResultAsync();
            var gelirler = new List<object>();
            while (await reader.ReadAsync())
            {
                gelirler.Add(new
                {
                    ParaBirimi = reader["Kod"].ToString(),
                    Toplam = reader["Toplam"]
                });
            }
            result["BuAyGelir"] = gelirler;

            await reader.NextResultAsync();
            var sonHareketler = new List<object>();
            while (await reader.ReadAsync())
            {
                sonHareketler.Add(new
                {
                    VadeTarihi = Convert.ToDateTime(reader["VadeTarihi"]).ToString("dd.MM.yyyy"),
                    OdemeTarihi = reader["OdemeTarihi"] == DBNull.Value ? "-" : Convert.ToDateTime(reader["OdemeTarihi"]).ToString("dd.MM.yyyy"),
                    Tutar = reader["Tutar"],
                    ParaBirimi = reader["ParaBirimi"].ToString(),
                    Durum = reader["DurumAdi"].ToString(),
                    Kiraci = reader["Kiraci"].ToString(),
                    Mulk = reader["Mulk"].ToString()
                });
            }
            result["SonHareketler"] = sonHareketler;

            return Ok(result);
        }

        // Tenant Dashboard
        [HttpGet("tenant/{tenantId}")]
        public async Task<IActionResult> GetTenantDashboard(int tenantId)
        {
            var result = new Dictionary<string, object>();

            using var conn = Connection.GetConnection();
            await conn.OpenAsync();

            string sql = @"
                -- 1. KİRACI BİLGİLERİ VE AKTİF SÖZLEŞME
                SELECT TOP(1)
                    KS.KiraSozlesmeID,
                    KS.AylikKiraTutar,
                    PB.Kod AS ParaBirimiKod,
                    KS.OdemeGunu,
                    KS.BaslangicTarihi,
                    KS.BitisTarihi,
                    M.Baslik AS MulkBaslik,
                    M.Adres AS MulkAdres,
                    OwnerUser.AdSoyad AS SahipAd
                FROM Kiraci K
                INNER JOIN Kullanici KiraciUser ON K.KullaniciID = KiraciUser.KullaniciID
                INNER JOIN KiraSozlesme KS ON K.KiraciID = KS.KiraciID
                INNER JOIN Mulk M ON KS.MulkID = M.MulkID
                INNER JOIN Kullanici OwnerUser ON M.SahipKullaniciID = OwnerUser.KullaniciID
                INNER JOIN ParaBirimi PB ON KS.ParaBirimiID = PB.ParaBirimiID
                WHERE K.KullaniciID = @tenantId AND KS.AktifMi = 1
                ORDER BY KS.BaslangicTarihi DESC;

                -- 2. BEKLİYEN ÖDEMELER
                SELECT 
                    KO.KiraOdemeID,
                    KO.VadeTarihi,
                    KO.Tutar,
                    PB.Kod AS ParaBirimiKod,
                    OD.DurumAdi
                FROM KiraOdeme KO
                INNER JOIN KiraSozlesme KS ON KO.KiraSozlesmeID = KS.KiraSozlesmeID
                INNER JOIN Kiraci K ON KS.KiraciID = K.KiraciID
                INNER JOIN ParaBirimi PB ON KO.ParaBirimiID = PB.ParaBirimiID
                INNER JOIN OdemeDurum OD ON KO.OdemeDurumID = OD.OdemeDurumID
                WHERE K.KullaniciID = @tenantId 
                  AND (OD.DurumAdi = 'Pending' OR OD.DurumAdi = 'Late')
                ORDER BY KO.VadeTarihi ASC;

                -- 3. SON ÖDEMELER (Son 5)
                SELECT TOP(5)
                    KO.OdemeTarihi,
                    KO.Tutar,
                    PB.Kod AS ParaBirimiKod,
                    M.Baslik AS MulkBaslik
                FROM KiraOdeme KO
                INNER JOIN KiraSozlesme KS ON KO.KiraSozlesmeID = KS.KiraSozlesmeID
                INNER JOIN Kiraci K ON KS.KiraciID = K.KiraciID
                INNER JOIN Mulk M ON KS.MulkID = M.MulkID
                INNER JOIN ParaBirimi PB ON KO.ParaBirimiID = PB.ParaBirimiID
                INNER JOIN OdemeDurum OD ON KO.OdemeDurumID = OD.OdemeDurumID
                WHERE K.KullaniciID = @tenantId 
                  AND OD.DurumAdi = 'Paid'
                  AND KO.OdemeTarihi IS NOT NULL
                ORDER BY KO.OdemeTarihi DESC;
            ";

            using var cmd = new SqlCommand(sql, conn);
            cmd.Parameters.AddWithValue("@tenantId", tenantId);
            using var reader = await cmd.ExecuteReaderAsync();

            if (await reader.ReadAsync())
            {
                result["AktifSozlesme"] = new
                {
                    KiraSozlesmeID = reader["KiraSozlesmeID"],
                    AylikKiraTutar = reader["AylikKiraTutar"],
                    ParaBirimiKod = reader["ParaBirimiKod"].ToString(),
                    OdemeGunu = reader["OdemeGunu"],
                    BaslangicTarihi = Convert.ToDateTime(reader["BaslangicTarihi"]).ToString("dd.MM.yyyy"),
                    BitisTarihi = reader["BitisTarihi"] == DBNull.Value ? null : Convert.ToDateTime(reader["BitisTarihi"]).ToString("dd.MM.yyyy"),
                    MulkBaslik = reader["MulkBaslik"].ToString(),
                    MulkAdres = reader["MulkAdres"].ToString(),
                    SahipAd = reader["SahipAd"].ToString()
                };
            }


            await reader.NextResultAsync();
            var bekleyenOdemeler = new List<object>();
            while (await reader.ReadAsync())
            {
                bekleyenOdemeler.Add(new
                {
                    KiraOdemeID = reader["KiraOdemeID"],
                    VadeTarihi = Convert.ToDateTime(reader["VadeTarihi"]).ToString("dd.MM.yyyy"),
                    Tutar = reader["Tutar"],
                    ParaBirimiKod = reader["ParaBirimiKod"].ToString(),
                    Durum = reader["DurumAdi"].ToString()
                });
            }
            result["BekleyenOdemeler"] = bekleyenOdemeler;


            await reader.NextResultAsync();
            var sonOdemeler = new List<object>();
            while (await reader.ReadAsync())
            {
                sonOdemeler.Add(new
                {
                    OdemeTarihi = Convert.ToDateTime(reader["OdemeTarihi"]).ToString("dd.MM.yyyy"),
                    Tutar = reader["Tutar"],
                    ParaBirimiKod = reader["ParaBirimiKod"].ToString(),
                    MulkBaslik = reader["MulkBaslik"].ToString()
                });
            }
            result["SonOdemeler"] = sonOdemeler;

            return Ok(result);
        }
    }
}

