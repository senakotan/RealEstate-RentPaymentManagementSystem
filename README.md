# 🏠 Real Estate Management System

The **Real Estate Management System** is a web-based application designed to enable individuals with multiple properties, real estate offices, and portfolio managers to manage all their real estate assets, tenants, and rent payments from a single, centralized platform.

## 🎯 Project Purpose

In traditional real estate management, property information is often scattered, tenant communication is difficult, and tracking payments can be confusing. This project solves these problems by consolidating all processes into a user-friendly interface, ensuring that financial status is clearly visible and administrative tasks are streamlined.

## 🚀 Key Features

### 1. Property Management
* Detailed records of properties (Location, type, square meters, room count).
* Purchase information and valuation tracking.
* Visual management with photo uploads and document archiving (title deeds, reports).

### 2. Tenant Management
* Centralized database for tenant contact and identity information.
* Distinction between active and past tenants.
* Easy search and filtering options.

### 3. Lease Agreement Management
* Digital lease contracts with start/end dates, rent amount, and deposit details.
* Automatic creation of monthly payment plans.
* Tracking of contract status (Active, Expiring, Expired).

### 4. Payment & Financial Tracking
* Detailed tracking of rent payments with statuses: **Paid**, **Pending**, **Overdue**.
* Automatic detection of overdue payments.
* Income-expense analysis and bank account management.
* Support for multiple currencies (TRY, USD, EUR).

### 5. Notifications
* Alerts for contract expirations.
* Reminders for upcoming payment due dates and maintenance schedules.

---

## 🛠️ Technical Structure

The project follows a **3-Tier Architecture** (Presentation, Business Logic, Data Layer).

### Backend 
* **Framework:** ASP.NET Core 8.0 Web API
* **Language:** C#
* **Database:** Microsoft SQL Server
* **Architecture:** RESTful API

### Frontend 
* **Core Technologies:** HTML5, CSS3, JavaScript
* **Communication:** Fetch API (for consuming backend endpoints)
* **Design:** Responsive (Mobile-friendly)

### Database Design
The system is built on a comprehensive relational database schema consisting of **21 tables**, designed according to normalization principles.
* **Core Entities:** Users, Properties, Tenants, Lease Contracts, Rent Payments.
* **Security:** Parameterized SQL queries are used to prevent SQL Injection.

---

## 💻 Usage Flow

1.  **System Login:** Secure user login via email and password.
2.  **Property Registration:** User adds owned properties with full details.
3.  **Tenant Entry:** Tenant information is recorded in the system.
4.  **Contract Creation:** Properties are linked to tenants via lease agreements; payment plans are auto-generated.
5.  **Tracking:** Payments are marked as they are received; dashboard updates instantly.
6.  **Reporting:** View total assets, active contracts, and financial summaries on the dashboard.

---

## 📸 UI Preview

![WhatsApp Image 2026-01-10 at 23 53 46](https://github.com/user-attachments/assets/7877a96d-c000-4b7b-89fa-01f035b36acf)


![WhatsApp Image 2026-01-10 at 23 53 46 (1)](https://github.com/user-attachments/assets/754dc2b0-8631-49d9-a270-afdb2d5f42c5)



---

## 📄 License

This is an academic group project aimed at designing a comprehensive database system.
