export function LayoutCanvas({ layout }) {
  if (!layout?.json?.objects) return <div className="card">No layout data.</div>;

  return (
    <div className="layout-canvas">
      {layout.json.objects.map((obj) => {
        if (obj.type === "pump") {
          const sides = obj.sides || {};
          return (
            <div
              key={obj.id}
              className="layout-object object-pump"
              style={{
                left: 20 + (obj.slotIndex || 0) * 130,
                top: 540,
                width: 110,
                height: 80
              }}
            >
              <div>
                <div>{obj.label}</div>
                <div className="pump-sides">
                  A: {sides.A?.ip || "n/a"} | B: {sides.B?.ip || "n/a"}
                </div>
              </div>
            </div>
          );
        }

        return (
          <div
            key={obj.id}
            className={`layout-object object-${obj.type}`}
            style={{
              left: obj.x,
              top: obj.y,
              width: obj.w,
              height: obj.h,
              transform: `rotate(${obj.rotation || 0}deg)`
            }}
          >
            {obj.label || obj.type}
          </div>
        );
      })}
    </div>
  );
}
