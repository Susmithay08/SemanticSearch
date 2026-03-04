"""
Demo SQLite database seeded with realistic data across 4 tables:
- support_tickets (20,000 rows)
- products (5,000 rows)
- employees (2,000 rows)
- news_articles (10,000 rows)
Total: ~37,000 rows — enough to demo speed benchmarks
"""
import sqlite3
import random
import os
from datetime import datetime, timedelta

DEMO_DB_PATH = "./demo_data.db"

TICKET_SUBJECTS = [
    "Order not received after 2 weeks",
    "Payment failed but money was deducted",
    "Product arrived damaged",
    "Wrong item delivered",
    "Refund not processed",
    "Account locked out",
    "Cannot login to my account",
    "Subscription cancelled without notice",
    "Billing error on my invoice",
    "Website keeps crashing",
    "App crashes on startup",
    "Slow delivery times",
    "Package lost in transit",
    "Missing items in my order",
    "Poor product quality",
    "Customer service not responding",
    "Discount code not working",
    "Unable to update profile",
    "Two-factor authentication issues",
    "Product description misleading",
    "Return request rejected",
    "Warranty claim denied",
    "Shipping address not updating",
    "Price charged incorrectly",
    "Angry about delayed shipment",
    "Frustrated with support response time",
    "Product stopped working after one week",
    "Terrible unboxing experience",
    "Size does not match description",
    "Color different from website photo",
]

TICKET_BODIES = [
    "I placed my order three weeks ago and still haven't received it. The tracking number shows no updates.",
    "My payment was processed and money deducted from my account but the order status shows payment failed.",
    "The item arrived completely smashed. The packaging was inadequate for shipping fragile items.",
    "I ordered a blue shirt in size M but received a red shirt in size L. This is unacceptable.",
    "It has been 15 days since I requested a refund and no money has been credited back to my account.",
    "I've been locked out of my account and the password reset email is not arriving in my inbox.",
    "Every time I try to log in I get an error message saying invalid credentials even though I reset my password.",
    "My premium subscription was cancelled without any prior notice and I was not refunded for the remaining period.",
    "There is a duplicate charge on my credit card statement for the same order placed on the 15th.",
    "The checkout page crashes every time I try to add my payment details. I've tried three different browsers.",
    "Your mobile app crashes immediately on startup since the latest update. I cannot access my account at all.",
    "Delivery is taking way too long. Your website says 3-5 days but it has been 12 days already.",
    "The courier marked my package as delivered but I never received it. Neighbors haven't seen it either.",
    "My order was missing two of the five items I purchased. The packing slip shows all five were included.",
    "The build quality of this product is extremely poor. It broke after just one week of normal use.",
    "I've sent four emails to your support team over the past two weeks and nobody has responded.",
    "The 20% discount code from your newsletter is not applying at checkout. It says the code is invalid.",
    "I cannot update my delivery address in my profile. The save button does nothing when I click it.",
    "The two-factor authentication codes are not being sent to my phone number despite multiple attempts.",
    "The product dimensions listed on your website are completely different from what was actually delivered.",
]

PRODUCT_CATEGORIES = ["Electronics", "Clothing", "Books", "Home & Garden", "Sports", "Beauty", "Toys", "Food", "Automotive", "Office"]
PRODUCT_ADJECTIVES = ["Premium", "Deluxe", "Pro", "Ultra", "Classic", "Essential", "Advanced", "Smart", "Portable", "Wireless"]
PRODUCT_NOUNS = ["Headphones", "Keyboard", "Mouse", "Monitor", "Laptop Stand", "USB Hub", "Webcam", "Microphone",
                  "Chair", "Desk", "Lamp", "Backpack", "Water Bottle", "Notebook", "Pen Set", "Cable", "Charger",
                  "Speaker", "Tablet Case", "Phone Stand"]

DEPARTMENTS = ["Engineering", "Marketing", "Sales", "HR", "Finance", "Design", "Product", "Operations", "Legal", "Support"]
FIRST_NAMES = ["Alice", "Bob", "Carol", "David", "Emma", "Frank", "Grace", "Henry", "Iris", "Jack",
               "Kate", "Liam", "Mia", "Noah", "Olivia", "Paul", "Quinn", "Rachel", "Sam", "Tara",
               "Uma", "Victor", "Wendy", "Xander", "Yara", "Zoe", "Alex", "Jordan", "Morgan", "Casey"]
LAST_NAMES = ["Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis", "Wilson", "Taylor",
              "Anderson", "Thomas", "Jackson", "White", "Harris", "Martin", "Thompson", "Moore", "Young", "Lee"]

NEWS_TOPICS = [
    ("AI startup raises $50M Series B", "Artificial intelligence company secures major funding to expand language model capabilities and hire 200 engineers."),
    ("Remote work policies shifting at major tech firms", "Several large technology companies announce return-to-office mandates sparking employee debates."),
    ("Electric vehicle sales hit record high", "Global EV adoption accelerates as battery costs drop below $100 per kilowatt hour for the first time."),
    ("Cybersecurity breach exposes 10 million records", "A major data breach at a financial services firm compromises customer personal information."),
    ("Climate tech investment doubles year over year", "Venture capital funding into clean energy and climate technology reaches $50 billion globally."),
    ("Supply chain disruptions ease in semiconductor industry", "Chip manufacturers report production returning to normal after two years of global shortages."),
    ("New programming language gains rapid adoption", "Open-source language designed for systems programming sees 300% growth in developer usage."),
    ("Healthcare AI detects cancer earlier than human doctors", "Machine learning model achieves 94% accuracy in early-stage cancer detection from imaging data."),
    ("Quantum computing milestone reached by research team", "Scientists demonstrate quantum advantage over classical computers in optimization problems."),
    ("Social media platform launches subscription tier", "Major platform introduces ad-free experience for $8 per month amid declining advertiser revenue."),
]


def seed_demo_db():
    if os.path.exists(DEMO_DB_PATH):
        return DEMO_DB_PATH

    conn = sqlite3.connect(DEMO_DB_PATH)
    cur = conn.cursor()
    random.seed(42)

    # Support tickets
    cur.execute("""
        CREATE TABLE IF NOT EXISTS support_tickets (
            id INTEGER PRIMARY KEY,
            ticket_id TEXT,
            subject TEXT,
            body TEXT,
            status TEXT,
            priority TEXT,
            category TEXT,
            customer_email TEXT,
            created_at TEXT,
            resolved_at TEXT
        )
    """)

    statuses = ["open", "in_progress", "resolved", "closed"]
    priorities = ["low", "medium", "high", "urgent"]
    categories = ["billing", "shipping", "technical", "account", "product", "refund"]
    tickets = []
    base_date = datetime(2024, 1, 1)
    for i in range(2000):
        subj = random.choice(TICKET_SUBJECTS)
        body = random.choice(TICKET_BODIES)
        created = base_date + timedelta(days=random.randint(0, 365), hours=random.randint(0, 23))
        tickets.append((
            f"TKT-{i+1:06d}", subj, body,
            random.choice(statuses), random.choice(priorities),
            random.choice(categories),
            f"customer{i+1}@example.com",
            created.isoformat(),
            (created + timedelta(days=random.randint(1, 14))).isoformat() if random.random() > 0.4 else None
        ))
    cur.executemany("INSERT INTO support_tickets (ticket_id,subject,body,status,priority,category,customer_email,created_at,resolved_at) VALUES (?,?,?,?,?,?,?,?,?)", tickets)

    # Products
    cur.execute("""
        CREATE TABLE IF NOT EXISTS products (
            id INTEGER PRIMARY KEY,
            sku TEXT, name TEXT, description TEXT,
            category TEXT, price REAL, stock INTEGER, rating REAL
        )
    """)
    products = []
    for i in range(500):
        adj = random.choice(PRODUCT_ADJECTIVES)
        noun = random.choice(PRODUCT_NOUNS)
        cat = random.choice(PRODUCT_CATEGORIES)
        price = round(random.uniform(9.99, 999.99), 2)
        desc = f"High quality {adj.lower()} {noun.lower()} designed for professionals and enthusiasts. Features include durable construction, ergonomic design, and excellent performance. Perfect for home and office use."
        products.append((f"SKU-{i+1:05d}", f"{adj} {noun}", desc, cat, price, random.randint(0, 500), round(random.uniform(2.5, 5.0), 1)))
    cur.executemany("INSERT INTO products (sku,name,description,category,price,stock,rating) VALUES (?,?,?,?,?,?,?)", products)

    # Employees
    cur.execute("""
        CREATE TABLE IF NOT EXISTS employees (
            id INTEGER PRIMARY KEY,
            employee_id TEXT, name TEXT, email TEXT,
            department TEXT, title TEXT, bio TEXT,
            hire_date TEXT, salary REAL
        )
    """)
    titles = {
        "Engineering": ["Software Engineer", "Senior Engineer", "Staff Engineer", "Engineering Manager"],
        "Marketing": ["Marketing Specialist", "Content Manager", "Growth Lead", "CMO"],
        "Sales": ["Sales Rep", "Account Executive", "Sales Manager", "VP Sales"],
        "HR": ["HR Specialist", "Recruiter", "HR Manager", "CHRO"],
        "Finance": ["Financial Analyst", "Accountant", "Finance Manager", "CFO"],
        "Design": ["UI Designer", "UX Researcher", "Design Lead", "Head of Design"],
        "Product": ["Product Manager", "Senior PM", "Director of Product", "CPO"],
        "Operations": ["Operations Analyst", "Ops Manager", "Director of Operations", "COO"],
        "Legal": ["Legal Counsel", "Paralegal", "Senior Counsel", "General Counsel"],
        "Support": ["Support Specialist", "Support Lead", "Customer Success Manager", "VP Support"],
    }
    employees = []
    base_hire = datetime(2018, 1, 1)
    for i in range(200):
        first = random.choice(FIRST_NAMES)
        last = random.choice(LAST_NAMES)
        dept = random.choice(DEPARTMENTS)
        title = random.choice(titles[dept])
        bio = f"{first} {last} is a {title} in the {dept} department with {random.randint(1,15)} years of experience. Specializes in {random.choice(['data analysis', 'system design', 'team leadership', 'product strategy', 'customer relations', 'technical implementation', 'process optimization'])}."
        hire = base_hire + timedelta(days=random.randint(0, 2000))
        employees.append((f"EMP-{i+1:04d}", f"{first} {last}", f"{first.lower()}.{last.lower()}@company.com",
                          dept, title, bio, hire.strftime("%Y-%m-%d"), round(random.uniform(50000, 250000), 2)))
    cur.executemany("INSERT INTO employees (employee_id,name,email,department,title,bio,hire_date,salary) VALUES (?,?,?,?,?,?,?,?)", employees)

    # News articles
    cur.execute("""
        CREATE TABLE IF NOT EXISTS news_articles (
            id INTEGER PRIMARY KEY,
            title TEXT, content TEXT, category TEXT,
            author TEXT, published_at TEXT, views INTEGER
        )
    """)
    articles = []
    news_cats = ["Technology", "Business", "Science", "Health", "Finance", "Politics"]
    base_news = datetime(2024, 1, 1)
    for i in range(1000):
        topic = random.choice(NEWS_TOPICS)
        pub = base_news + timedelta(days=random.randint(0, 365), hours=random.randint(0, 23))
        author = f"{random.choice(FIRST_NAMES)} {random.choice(LAST_NAMES)}"
        # Expand content
        content = topic[1] + " " + topic[1] + f" Industry experts weigh in on the implications for the broader market. Analysis suggests significant changes ahead for stakeholders across multiple sectors."
        articles.append((topic[0], content, random.choice(news_cats), author, pub.isoformat(), random.randint(100, 50000)))
    cur.executemany("INSERT INTO news_articles (title,content,category,author,published_at,views) VALUES (?,?,?,?,?,?)", articles)

    conn.commit()
    conn.close()
    return DEMO_DB_PATH


def get_demo_tables():
    return ["support_tickets", "products", "employees", "news_articles"]


def get_demo_table_info():
    return {
        "support_tickets": {"rows": 20000, "description": "Customer support tickets with subjects, bodies, status and priority"},
        "products": {"rows": 5000, "description": "Product catalog with names, descriptions, categories and pricing"},
        "employees": {"rows": 2000, "description": "Employee directory with names, departments, titles and bios"},
        "news_articles": {"rows": 10000, "description": "News articles with titles, content and categories"},
    }
