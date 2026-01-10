namespace EmlakYonetimAPI.Models
{
    // Bu model veritabaný kayýt/güncelleme iþlemleri için
    public class Mulk
    {
        public int MulkID { get; set; }
        public int SahipKullaniciID { get; set; }
        public int MulkTuruID { get; set; }
        public int IlceID { get; set; }

        public string Baslik { get; set; } = string.Empty;
        public string Adres { get; set; } = string.Empty;
        public string? OdaSayisi { get; set; } // Örn: 3+1
        public decimal Metrekare { get; set; }

        public DateTime? AlimTarihi { get; set; }
        public decimal? AlimBedeli { get; set; }
        public int? ParaBirimiID { get; set; }

        public bool AktifMi { get; set; } = true;
        public string? Aciklama { get; set; }
        public DateTime OlusturmaTarihi { get; set; }
    }
}