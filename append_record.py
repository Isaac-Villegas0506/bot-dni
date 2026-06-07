import os

with open("backend/main.py", "a", encoding="utf-8") as f:
    f.write("""

@app.post("/api/vehiculos/record")
async def generate_record_api(request: Request, body_data: dict = Body(...), user: dict = Depends(get_current_user)):
    target = body_data.get("target")
    if not target: raise HTTPException(status_code=400, detail="Placa/DNI requerido")
    check_banned_dni(target)
    client_ip = request.headers.get('X-Forwarded-For', request.client.host if request.client else '').split(',')[0].strip()
    
    try:
        user_id = user['id']
        cost = await db.get_cost_for_option('record_vehicular')
        cost = cost if cost is not None else 2

        if user.get('role') != 'admin':
            if not user.get('is_premium') and user.get('credits', 0) < cost:
                raise HTTPException(status_code=402, detail="Créditos insuficientes")
            
            success = await db.deduct_credits(user_id, cost, f"Búsqueda RECORD para {target}")
            if not success:
                raise HTTPException(status_code=402, detail="Error al descontar créditos")

        asyncio.create_task(
            notify_admins_new_search(user, "RECORD", target, "API", client_ip)
        )

        res = await bot_client.query_record(target)

        await db.register_search(
            user_id=user_id,
            search_type="record",
            query_target=target,
            raw_response=res.get("raw_text", ""),
            credits_used=cost if user.get('role') != 'admin' else 0,
            ip_address=client_ip
        )
        return {"data": res, "file_path": res.get("file_path")}

    except SinResultadosError as e:
        if user.get('role') != 'admin' and not user.get('is_premium'):
            await db.refund_credits(user_id, cost, f"Reembolso RECORD (Sin resultados) para {target}")
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        if user.get('role') != 'admin' and not user.get('is_premium'):
            await db.refund_credits(user_id, cost, f"Reembolso RECORD (Error) para {target}")
        raise HTTPException(status_code=500, detail=str(e))
""")
print("Appended /api/vehiculos/record")
