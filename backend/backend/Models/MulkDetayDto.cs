namespace EmlakYonetimAPI.Models
{
    // Bu model sadece veri okurken (Listeleme/Detay) kullanýlacak
    public class MulkDetayDto
    {
        public int MulkID { get; set; }
        public string Baslik { get; set; } = string.Empty;
        public string Adres { get; set; } = string.Empty;
        public string? OdaSayisi { get; set; }
        public decimal Metrekare { get; set; }
        public DateTime? AlimTarihi { get; set; }
        public decimal? AlimBedeli { get; set; }
        public bool AktifMi { get; set; }
        public string? Aciklama { get; set; }

        // Ýliþkili tablolardan gelen veriler
        public string? ParaBirimiKod { get; set; } // TRY, USD
        public string MulkTuruAd { get; set; } = string.Empty; // Daire, Ofis
        public string SehirAd { get; set; } = string.Empty;
        public string IlceAd { get; set; } = string.Empty;
        public string SahipAdSoyad { get; set; } = string.Empty;
    }
}