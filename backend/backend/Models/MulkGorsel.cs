namespace EmlakYonetimAPI.Models
{
    public class MulkGorsel
    {
        public int MulkGorselID { get; set; }
        public int MulkID { get; set; }
        public string DosyaYolu { get; set; } = string.Empty;
        public string? Aciklama { get; set; }
        public DateTime YuklemeTarihi { get; set; }
        public bool AktifMi { get; set; }
    }
}
