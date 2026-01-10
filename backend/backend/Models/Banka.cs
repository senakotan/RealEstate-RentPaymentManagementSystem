namespace EmlakYonetimAPI.Models
{
    public class Banka
    {
        public int BankaID { get; set; }
        public string BankaAdi { get; set; } = string.Empty;
        public string? Aciklama { get; set; }
    }
}
