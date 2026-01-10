namespace EmlakYonetimAPI.Models
{
    public class BakimTalep
    {
        public int BakimTalepID { get; set; }
        public int MulkID { get; set; }
        public DateTime TalepTarihi { get; set; }
        public string Aciklama { get; set; } = string.Empty;
        public string Durum { get; set; } = string.Empty;
        public decimal? TahminiTutar { get; set; }
        public DateTime? GerceklesmeTarihi { get; set; }
    }
}
