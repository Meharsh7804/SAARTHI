import { Info, User, Clock } from "lucide-react";

const vehicles = [
  {
    id: 1,
    name: "Saarthi Go",
    description: "Comfy, air-conditioned cars",
    type: "car",
    image: "car.png",
    price: 193.8,
  },
  {
    id: 2,
    name: "Saarthi Moto",
    description: "Quick, single-rider bikes",
    type: "bike",
    image: "bike.webp",
    price: 254.7,
  },
  {
    id: 3,
    name: "Saarthi Auto",
    description: "Classic, open-air three-wheelers",
    type: "auto",
    image: "auto.webp",
    price: 200.0,
  },
];

function SelectVehicle({
  selectedVehicle,
  setSelectedVehicle,
  fare,
  setShowPanel,
  showNextPanel,
  rideMode
}) {
  return (
    <div className="w-full flex flex-col gap-3 py-2">
      {vehicles.map((vehicle, index) => (
        <Vehicle
          key={vehicle.id}
          vehicle={vehicle}
          fare={fare}
          selectedVehicle={selectedVehicle}
          setSelectedVehicle={setSelectedVehicle}
          setShowPanel={setShowPanel}
          showNextPanel={showNextPanel}
          rideMode={rideMode}
        />
      ))}
    </div>
  );
}

const Vehicle = ({
  vehicle,
  selectedVehicle,
  setSelectedVehicle,
  fare,
  setShowPanel,
  showNextPanel,
  rideMode
}) => {
  const isSelected = selectedVehicle === vehicle.type;

  return (
    <div
      onClick={() => {
        setSelectedVehicle(vehicle.type);
        setShowPanel(false);
        showNextPanel(true);
      }}
      className={`group relative cursor-pointer flex items-center w-full rounded-2xl border-2 p-3 transition-all duration-300 ${
        isSelected
          ? (rideMode === "female-only" ? "border-pink-500 bg-pink-50/50 ring-4 ring-pink-500/10" : "border-black bg-zinc-50 shadow-lg shadow-black/5")
          : "border-zinc-100 bg-white hover:border-zinc-300 hover:shadow-md"
      }`}
    >
      <div className={`relative w-20 h-20 flex items-center justify-center p-2 rounded-xl transition-transform duration-300 group-hover:scale-110 ${
        rideMode === "female-only" ? "bg-pink-100/50" : "bg-zinc-100/50"
      }`}>
        <img
          src={`/${vehicle.image}`}
          className="w-full h-full object-contain mix-blend-multiply"
          alt={vehicle.name}
        />
      </div>

      <div className="flex-1 ml-4 pr-2">
        <div className="flex items-center gap-1.5 mb-0.5">
          <h1 className="text-base font-bold tracking-tight">{vehicle.name}</h1>
          <div className="flex items-center gap-0.5 bg-zinc-100 px-1.5 py-0.5 rounded-md">
            <User size={10} className="text-zinc-500" />
            <span className="text-[10px] font-bold text-zinc-600">
               {vehicle.type === 'bike' ? '1' : vehicle.type === 'auto' ? '3' : '4'}
            </span>
          </div>
        </div>
        <p className="text-[10px] text-zinc-500 font-semibold leading-tight line-clamp-1">{vehicle.description}</p>
        <div className="flex items-center gap-2 mt-1.5">
          <div className="flex items-center gap-1 text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
            <Clock size={10} />
            6 min away
          </div>
        </div>
      </div>

      <div className="text-right">
        <p className="text-xs text-zinc-400 font-bold line-through">₹{(fare[vehicle.type] * 1.2).toFixed(0)}</p>
        <h3 className="text-lg font-bold tracking-tighter">₹ {fare[vehicle.type]}</h3>
      </div>
      
      {isSelected && (
        <div className={`absolute top-2 right-2 w-2 h-2 rounded-full ${rideMode === "female-only" ? "bg-pink-500" : "bg-black"}`} />
      )}
    </div>
  );
};

export default SelectVehicle;
