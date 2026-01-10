namespace EmlakYonetimAPI.Models
{
    public class Logkayit
    {
        public int LogKayitID { get; set; }
        public int? KullaniciID { get; set; }

        public DateTime IslemTarihi { get; set; }
        public string IslemTuru { get; set; } = string.Empty;
        public string TabloAdi { get; set; } = string.Empty;
        public string? KayitID { get; set; }
        public string? Detay { get; set; }
    }
}
