namespace EmlakYonetimAPI.Models
{
    public class MulkDegerleme
    {
        public int MulkDegerlemeID { get; set; }
        public int MulkID { get; set; }

        public DateTime DegerTarihi { get; set; }
        public decimal TahminiDeger { get; set; }
        public int ParaBirimiID { get; set; }

        public string? Kaynak { get; set; }
        public string? Aciklama { get; set; }
    }
}
