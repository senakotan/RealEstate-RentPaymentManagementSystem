namespace EmlakYonetimAPI.Models
{
    public class OdemeDetayDto
    {
        public int KiraOdemeID { get; set; }
        public int KiraSozlesmeID { get; set; }
        public string SozlesmeNo { get; set; } = string.Empty;
        public string KiraciAdSoyad { get; set; } = string.Empty;

        public string VadeTarihi { get; set; } = string.Empty; 
        public string? OdemeTarihi { get; set; }

        public decimal Tutar { get; set; }
        public string ParaBirimi { get; set; } = string.Empty;

        public string DurumAd { get; set; } = string.Empty; 
        public string Stil { get; set; } = string.Empty; 

        public string? OdemeYontemAd { get; set; }
        public string? Aciklama { get; set; }
    }
}
