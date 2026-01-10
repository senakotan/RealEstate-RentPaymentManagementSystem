namespace EmlakYonetimAPI.Models
{
    public class KiraSozlesme
    {
        public int KiraSozlesmeID { get; set; }
        public int MulkID { get; set; }
        public int KiraciID { get; set; }

        public string? SozlesmeNo { get; set; }
        public DateTime BaslangicTarihi { get; set; }
        public DateTime? BitisTarihi { get; set; }

        public decimal AylikKiraTutar { get; set; }
        public int ParaBirimiID { get; set; }
        public decimal? DepozitoTutar { get; set; }
        public byte OdemeGunu { get; set; } // 1-31 arasý

        public bool AktifMi { get; set; } = true;
        public string? Aciklama { get; set; }
        public DateTime OlusturmaTarihi { get; set; }
    }
}