@celery_app.task
def update_all_prices():
    db = SessionLocal()
    portfolio = db.query(Portfolio).first()
    holdings = db.query(Holding).filter(Holding.portfolio_id == portfolio.id).all()
    for h in holdings:
        price, _, pct = fetch_price(h.symbol)
        if price:
            h.current_price = price
            h.change_percent = pct
            h.market_value = price * h.quantity
            h.gain_loss = (price - h.purchase_price) * h.quantity
        if h.type == 'etf':
            for u in h.underlyings:
                u_price, _, _ = fetch_price(u.symbol)
                # Store underlying price if needed (add field later)
    db.commit()
    db.close()

# In beat_schedule: "update-prices-every-15min": {"task": "app.tasks.update_all_prices", "schedule": 900.0}