namespace EmlakYonetimAPI.Models
{
    public class KiraOdeme
    {
        public int KiraOdemeID { get; set; }
        public int KiraSozlesmeID { get; set; }

        public DateTime VadeTarihi { get; set; } 
        public DateTime? OdemeTarihi { get; set; } 

        public decimal Tutar { get; set; }
        public int ParaBirimiID { get; set; }

        public int OdemeDurumID { get; set; } 
        public int? OdemeYontemID { get; set; } 
        
        public string? Aciklama { get; set; }
        public DateTime OlusturmaTarihi { get; set; }
    }
}
