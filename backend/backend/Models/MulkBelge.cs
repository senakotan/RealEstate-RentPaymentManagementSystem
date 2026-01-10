namespace EmlakYonetimAPI.Models
{
    public class MulkBelge
    {
        public int MulkBelgeID { get; set; }
        public int MulkID { get; set; }
        public string BelgeTuru { get; set; } = string.Empty;
        public string DosyaYolu { get; set; } = string.Empty;
        public DateTime YuklemeTarihi { get; set; }
        public string? Aciklama { get; set; }
    }
}
