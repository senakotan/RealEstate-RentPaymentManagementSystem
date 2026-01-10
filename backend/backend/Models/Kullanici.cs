namespace EmlakYonetimAPI.Models
{
    public class Kullanici
    {
        public int KullaniciID { get; set; }
        public string AdSoyad { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string SifreHash { get; set; } = string.Empty;
        public string? Telefon { get; set; }
        public string? TCNo { get; set; }
        public bool AktifMi { get; set; }
        public DateTime KayitTarihi { get; set; }
    }
}
