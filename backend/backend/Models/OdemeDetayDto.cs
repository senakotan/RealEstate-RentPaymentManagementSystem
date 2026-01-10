namespace EmlakYonetimAPI.Models
{
    public class OdemeDetayDto
    {
        public int KiraOdemeID { get; set; }
        public int KiraSozlesmeID { get; set; }
        public string SozlesmeNo { get; set; } = string.Empty;
        public string KiraciAdSoyad { get; set; } = string.Empty;

        public string VadeTarihi { get; set; } = string.Empty; // "05.06.2024" formatýnda
        public string? OdemeTarihi { get; set; }

        public decimal Tutar { get; set; }
        public string ParaBirimi { get; set; } = string.Empty;

        public string DurumAd { get; set; } = string.Empty; // Paid, Pending
        public string Stil { get; set; } = string.Empty; // Frontend için renk kodu (success, danger)

        public string? OdemeYontemAd { get; set; }
        public string? Aciklama { get; set; }
    }
}