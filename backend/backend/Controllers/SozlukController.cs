using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using EmlakYonetimAPI.DbHelper;
using EmlakYonetimAPI.Models;
using System.Data;

namespace EmlakYonetimAPI.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class SozlukController : ControllerBase
    {
        // ?? EN ÖNEMLÝ METOT: Tüm sözlük verilerini TEK SEFERDE getirir.
        // Frontend açýlýþta bunu çaðýrýp her þeyi cache'leyebilir.
        [HttpGet("all")]
        public async Task<ActionResult> GetAllLookups()
        {
            var result = new Dictionary<string, object>();

            using var conn = Connection.GetConnection();
            await conn.OpenAsync();

            // Tek bir SQL string içinde hepsini istiyoruz
            string sql = @"
                SELECT * FROM Sehir ORDER BY SehirAdi;
                SELECT * FROM Ilce ORDER BY IlceAdi;
                SELECT * FROM MulkTuru ORDER BY Ad;
                SELECT * FROM ParaBirimi ORDER BY Kod;
                SELECT * FROM OdemeDurum ORDER BY OdemeDurumID;
                SELECT * FROM OdemeYontem ORDER BY OdemeYontemID;
            ";

            using var cmd = new SqlCommand(sql, conn);
            using var reader = await cmd.ExecuteReaderAsync();

            // 1. Þehirler
            var sehirler = new List<Sehir>();
            while (await reader.ReadAsync())
            {
                sehirler.Add(new Sehir { SehirID = reader.GetInt32(0), SehirAdi = reader.GetString(1) });
            }
            result["Sehir"] = sehirler;

            // 2. Ýlçeler (Sonraki Sonuç Kümesi)
            await reader.NextResultAsync();
            var ilceler = new List<Ilce>();
            while (await reader.ReadAsync())
            {
                ilceler.Add(new Ilce { IlceID = reader.GetInt32(0), SehirID = reader.GetInt32(1), IlceAdi = reader.GetString(2) });
            }
            result["Ilce"] = ilceler;

            // 3. Mülk Türleri
            await reader.NextResultAsync();
            var mulkTurleri = new List<MulkTuru>();
            while (await reader.ReadAsync())
            {
                mulkTurleri.Add(new MulkTuru
                {
                    MulkTuruID = reader.GetInt32(0),
                    Ad = reader.GetString(1),
                    Aciklama = reader.IsDBNull(2) ? null : reader.GetString(2)
                });
            }
            result["MulkTuru"] = mulkTurleri;

            // 4. Para Birimleri
            await reader.NextResultAsync();
            var paraBirimleri = new List<ParaBirimi>();
            while (await reader.ReadAsync())
            {
                paraBirimleri.Add(new ParaBirimi
                {
                    ParaBirimiID = reader.GetInt32(0),
                    Kod = reader.GetString(1),
                    Ad = reader.GetString(2),
                    Sembol = reader.GetString(3)
                });
            }
            result["ParaBirimi"] = paraBirimleri;

            // 5. Ödeme Durumlarý
            await reader.NextResultAsync();
            var odemeDurumlari = new List<OdemeDurum>();
            while (await reader.ReadAsync())
            {
                odemeDurumlari.Add(new OdemeDurum
                {
                    OdemeDurumID = reader.GetInt32(0),
                    DurumAdi = reader.GetString(1),
                    Aciklama = reader.IsDBNull(2) ? null : reader.GetString(2)
                });
            }
            result["OdemeDurum"] = odemeDurumlari;

            // 6. Ödeme Yöntemleri
            await reader.NextResultAsync();
            var odemeYontemleri = new List<OdemeYontem>();
            while (await reader.ReadAsync())
            {
                odemeYontemleri.Add(new OdemeYontem
                {
                    OdemeYontemID = reader.GetInt32(0),
                    YontemAdi = reader.GetString(1),
                    Aciklama = reader.IsDBNull(2) ? null : reader.GetString(2)
                });
            }
            result["OdemeYontem"] = odemeYontemleri;

            return Ok(result);
        }

        // --- TEKLÝ ENDPOINTLER (Ýhtiyaç duyulursa diye korudum) ---

        [HttpGet("sehir")]
        public async Task<ActionResult> GetSehirler()
        {
            return Ok(await FetchList<Sehir>("SELECT SehirID, SehirAdi FROM Sehir ORDER BY SehirAdi",
                r => new Sehir { SehirID = r.GetInt32(0), SehirAdi = r.GetString(1) }));
        }

        [HttpGet("ilce/{sehirId}")]
        public async Task<ActionResult> GetIlceler(int sehirId)
        {
            var list = new List<Ilce>();
            using var conn = Connection.GetConnection();
            await conn.OpenAsync();
            using var cmd = new SqlCommand("SELECT IlceID, SehirID, IlceAdi FROM Ilce WHERE SehirID=@id ORDER BY IlceAdi", conn);
            cmd.Parameters.AddWithValue("@id", sehirId);
            using var r = await cmd.ExecuteReaderAsync();
            while (await r.ReadAsync())
            {
                list.Add(new Ilce { IlceID = r.GetInt32(0), SehirID = r.GetInt32(1), IlceAdi = r.GetString(2) });
            }
            return Ok(list);
        }

        // Genel Ýstatistikler (Optimize Edildi - Tek Sorgu)
        [HttpGet("stats")]
        public async Task<ActionResult> GetStats()
        {
            using var conn = Connection.GetConnection();
            await conn.OpenAsync();

            string sql = @"
                SELECT 
                    (SELECT COUNT(*) FROM Sehir) AS Sehir,
                    (SELECT COUNT(*) FROM Ilce) AS Ilce,
                    (SELECT COUNT(*) FROM MulkTuru) AS MulkTuru,
                    (SELECT COUNT(*) FROM ParaBirimi) AS ParaBirimi,
                    (SELECT COUNT(*) FROM OdemeDurum) AS OdemeDurum,
                    (SELECT COUNT(*) FROM OdemeYontem) AS OdemeYontem";

            using var cmd = new SqlCommand(sql, conn);
            using var reader = await cmd.ExecuteReaderAsync();

            if (await reader.ReadAsync())
            {
                return Ok(new
                {
                    Sehir = reader["Sehir"],
                    Ilce = reader["Ilce"],
                    MulkTuru = reader["MulkTuru"],
                    ParaBirimi = reader["ParaBirimi"],
                    OdemeDurum = reader["OdemeDurum"],
                    OdemeYontem = reader["OdemeYontem"]
                });
            }
            return Ok(new { });
        }

        // ?? ÞEHÝR EKLE
        [HttpPost("sehir")]
        public async Task<ActionResult> AddSehir(Sehir model)
        {
            using var conn = Connection.GetConnection();
            await conn.OpenAsync();

            // Kontrol: Var mý?
            var checkCmd = new SqlCommand("SELECT SehirID FROM Sehir WHERE SehirAdi = @ad", conn);
            checkCmd.Parameters.AddWithValue("@ad", model.SehirAdi);
            var existingId = await checkCmd.ExecuteScalarAsync();

            if (existingId != null)
                return Ok(new { SehirID = (int)existingId, Message = "Þehir zaten var, mevcut ID dönüldü." });

            // Yoksa Ekle
            var sql = "INSERT INTO Sehir (SehirAdi) OUTPUT INSERTED.SehirID VALUES (@ad)";
            using var cmd = new SqlCommand(sql, conn);
            cmd.Parameters.AddWithValue("@ad", model.SehirAdi);

            var newId = (int)await cmd.ExecuteScalarAsync();
            return Ok(new { SehirID = newId, Message = "Yeni þehir eklendi." });
        }

        // ?? ÝLÇE EKLE
        [HttpPost("ilce")]
        public async Task<ActionResult> AddIlce(Ilce model)
        {
            using var conn = Connection.GetConnection();
            await conn.OpenAsync();

            // Kontrol: Bu þehirde bu ilçe var mý?
            var checkCmd = new SqlCommand("SELECT IlceID FROM Ilce WHERE SehirID = @sid AND IlceAdi = @ad", conn);
            checkCmd.Parameters.AddWithValue("@sid", model.SehirID);
            checkCmd.Parameters.AddWithValue("@ad", model.IlceAdi);
            var existingId = await checkCmd.ExecuteScalarAsync();

            if (existingId != null)
                return Ok(new { IlceID = (int)existingId, Message = "Ýlçe zaten var." });

            var sql = "INSERT INTO Ilce (SehirID, IlceAdi) OUTPUT INSERTED.IlceID VALUES (@sid, @ad)";
            using var cmd = new SqlCommand(sql, conn);
            cmd.Parameters.AddWithValue("@sid", model.SehirID);
            cmd.Parameters.AddWithValue("@ad", model.IlceAdi);

            var newId = (int)await cmd.ExecuteScalarAsync();
            return Ok(new { IlceID = newId, Message = "Yeni ilçe eklendi." });
        }

        // GENERIC HELPER (Kod tekrarýný önlemek için)
        // Bu helper sadece bu controller içindeki basit listeler için kullanýlabilir.
        private async Task<List<T>> FetchList<T>(string sql, Func<SqlDataReader, T> mapper)
        {
            var list = new List<T>();
            using var conn = Connection.GetConnection();
            await conn.OpenAsync();
            using var cmd = new SqlCommand(sql, conn);
            using var r = await cmd.ExecuteReaderAsync();
            while (await r.ReadAsync())
            {
                list.Add(mapper(r));
            }
            return list;
        }
    }
}