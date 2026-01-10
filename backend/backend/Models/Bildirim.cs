namespace EmlakYonetimAPI.Models
{
    public class Bildirim
    {
        public int BildirimID { get; set; }
        public int KullaniciID { get; set; }
        public string Baslik { get; set; } = string.Empty;
        public string Mesaj { get; set; } = string.Empty;
        public DateTime OlusturmaTarihi { get; set; }
        public bool OkunduMu { get; set; }
        public DateTime? OkunmaTarihi { get; set; }
    }
}
