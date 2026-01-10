namespace EmlakYonetimAPI.Models
{
    public class OdemeDurum
    {
        public int OdemeDurumID { get; set; }
        public string DurumAdi { get; set; } = string.Empty;
        public string? Aciklama { get; set; }
    }
}
