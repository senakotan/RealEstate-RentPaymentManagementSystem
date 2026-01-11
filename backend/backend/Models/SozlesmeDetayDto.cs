namespace EmlakYonetimAPI.Models
{
    public class SozlesmeDetayDto
    {
        public int KiraSozlesmeID { get; set; }
        public string SozlesmeNo { get; set; } = string.Empty;

        public int MulkID { get; set; }
        public string MulkBaslik { get; set; } = string.Empty;
        public string MulkAdres { get; set; } = string.Empty;
        public string MulkSahibiAd { get; set; } = string.Empty; 

        public int KiraciID { get; set; }
        public string KiraciAdSoyad { get; set; } = string.Empty;

        public decimal AylikKiraTutar { get; set; }
        public string ParaBirimiKod { get; set; } = string.Empty; 
        public byte OdemeGunu { get; set; }

        public DateTime BaslangicTarihi { get; set; }
        public DateTime? BitisTarihi { get; set; }
        public bool AktifMi { get; set; }
        
        public decimal? DepozitoTutar { get; set; }
        public string? Aciklama { get; set; }
        public int ParaBirimiID { get; set; } 
    }
}
