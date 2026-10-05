import test from "node:test";
import assert from "node:assert/strict";
import {InMemoryStockRepository} from "../repositories/in-memory-stock-repository";
import {StockApplicationService} from "../application/stock-application-service";
import {StockDomainError} from "../core/errors";

function setup(){
  const repo=new InMemoryStockRepository();
  let n=0;
  const service=new StockApplicationService(
    repo,
    "company-1",
    "user-1",
    ()=>`2026-10-05T10:00:${String(n).padStart(2,"0")}Z`,
    ()=>`id-${++n}`,
  );
  return{repo,service};
}

test("transfert change les emplacements sans changer le total",async()=>{
  const{service}=setup();
  const depot=await service.initialize();
  const camion=await service.createLocation({name:"Camion 1",type:"vehicule"});
  const item=await service.createItem({name:"Chevron",family:"materiaux",unit:"piece",initialQuantity:20,locationId:depot.id});
  await service.transferStock({productId:item.id,quantity:5,fromLocationId:depot.id,toLocationId:camion.id});
  const total=(await service.listItemViews())[0]!.snapshot.physicalQuantity;
  const rows=await service.locationBreakdown(item.id);
  assert.equal(total,20);
  assert.equal(rows.find(x=>x.location.id===depot.id)?.snapshot.physicalQuantity,15);
  assert.equal(rows.find(x=>x.location.id===camion.id)?.snapshot.physicalQuantity,5);
});

test("perte et casse diminuent le stock, retour chantier l'augmente",async()=>{
  const{service}=setup();
  const depot=await service.initialize();
  const item=await service.createItem({name:"Tuile",family:"materiaux",unit:"piece",initialQuantity:20,locationId:depot.id});
  await service.recordLoss({productId:item.id,quantity:2,locationId:depot.id,reason:"Perte"});
  await service.recordBreakage({productId:item.id,quantity:3,locationId:depot.id,reason:"Casse"});
  await service.recordSiteReturn({productId:item.id,quantity:4,locationId:depot.id,chantierId:"dupont"});
  const view=(await service.listItemViews())[0]!;
  assert.equal(view.snapshot.physicalQuantity,19);
  const types=(await service.movementHistory()).map(x=>x.movement.movementType);
  assert.ok(types.includes("LOSS"));
  assert.ok(types.includes("BREAKAGE"));
  assert.ok(types.includes("SITE_RETURN"));
});

test("inventaire crée un ajustement égal à l'écart",async()=>{
  const{service}=setup();
  const depot=await service.initialize();
  const item=await service.createItem({name:"BA13",family:"materiaux",unit:"piece",initialQuantity:10,locationId:depot.id});
  const result=await service.applyInventoryCount({productId:item.id,locationId:depot.id,countedQuantity:7});
  assert.equal(result.theoreticalQuantity,10);
  assert.equal(result.difference,-3);
  assert.equal(result.movement?.movementType,"ADJUSTMENT");
  assert.equal((await service.inventoryRows(depot.id))[0]?.theoreticalQuantity,7);
});

test("inventaire identique ne crée aucun mouvement",async()=>{
  const{service}=setup();
  const depot=await service.initialize();
  const item=await service.createItem({name:"Colle",family:"consommables",unit:"sac",initialQuantity:6,locationId:depot.id});
  const before=(await service.movementHistory()).length;
  const result=await service.applyInventoryCount({productId:item.id,locationId:depot.id,countedQuantity:6});
  const after=(await service.movementHistory()).length;
  assert.equal(result.movement,null);
  assert.equal(result.difference,0);
  assert.equal(before,after);
});

test("inventaire refuse une correction qui passerait sous la quantité réservée",async()=>{
  const{service}=setup();
  const depot=await service.initialize();
  const item=await service.createItem({name:"OSB",family:"materiaux",unit:"piece",initialQuantity:10,locationId:depot.id});
  await service.engine.reserve({companyId:"company-1",productId:item.id,quantity:8,unit:"piece",locationId:depot.id,sourceModule:"test"});
  await assert.rejects(
    ()=>service.applyInventoryCount({productId:item.id,locationId:depot.id,countedQuantity:5}),
    (error:unknown)=>error instanceof StockDomainError&&error.code==="STOCK_INSUFFICIENT",
  );
});

test("inventaire par emplacement expose le stock théorique",async()=>{
  const{service}=setup();
  const depot=await service.initialize();
  const camion=await service.createLocation({name:"Camion",type:"vehicule"});
  const item=await service.createItem({name:"Vis",family:"fournitures",unit:"boite",initialQuantity:10,locationId:depot.id});
  await service.transferStock({productId:item.id,quantity:4,fromLocationId:depot.id,toLocationId:camion.id});
  const rows=await service.inventoryRows(camion.id);
  assert.equal(rows[0]?.theoreticalQuantity,4);
});
