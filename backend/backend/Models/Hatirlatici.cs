namespace EmlakYonetimAPI.Models
{
    public class Hatirlatici
    {
        public int HatirlaticiID { get; set; }
        public int KullaniciID { get; set; }
        public int? IlgiliMulkID { get; set; }
        public int? IlgiliKiraSozlesmeID { get; set; }

        public string Baslik { get; set; } = string.Empty;
        public string? Aciklama { get; set; }

        public DateTime HatirlaticiTarihi { get; set; }
        public bool AktifMi { get; set; }
    }
}
