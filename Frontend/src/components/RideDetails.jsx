import {
  CreditCard,
  MapPin,
  PhoneCall,
  SendHorizontal,
  ArrowLeft,
  Share2,
  Sparkles,
  User,
  ShieldCheck,
  Navigation2
} from "lucide-react";
import Button from "./Button";

function RideDetails({
  pickupLocation,
  destinationLocation,
  selectedVehicle,
  fare,
  showPanel,
  setShowPanel,
  showPreviousPanel,
  createRide,
  cancelRide,
  loading,
  rideCreated,
  confirmedRideData,
  rideStatus,
  rideMode
}) {
  if (!showPanel) return null;

  return (
    <div className={`w-full flex flex-col transition-all duration-500 overflow-hidden ${
      rideMode === "female-only" ? "bg-pink-50/80 backdrop-blur-md" : "bg-white/95 backdrop-blur-md"
    }`}>
      {!rideCreated && (
        <div className="flex items-center px-6 py-4 border-b border-zinc-100">
            <button 
                onClick={() => {
                    setShowPanel(false);
                    showPreviousPanel(true);
                }}
                className={`p-2.5 rounded-full transition-all mr-3 shadow-sm border border-zinc-100 active:scale-90 ${
                  rideMode === "female-only" ? "bg-white text-pink-600" : "bg-white text-zinc-600"
                }`}
            >
                <ArrowLeft size={18} />
            </button>
            <div>
              <h2 className={`text-lg font-bold tracking-tight ${rideMode === "female-only" ? "text-pink-900" : "text-zinc-900"}`}>Confirm Your Trip</h2>
              <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Review details before booking</p>
            </div>
        </div>
      )}
      
      <div className="px-6 py-6 pb-24 overflow-y-auto max-h-[70vh]">
          {rideCreated && !confirmedRideData && (
            <div className="flex flex-col items-center py-8">
              <div className="relative mb-6">
                <div className={`w-20 h-20 rounded-full flex items-center justify-center animate-pulse ${
                  rideMode === "female-only" ? "bg-pink-100" : "bg-blue-50"
                }`}>
                  <Navigation2 className={`animate-bounce ${rideMode === "female-only" ? "text-pink-500" : "text-blue-500"}`} size={32} />
                </div>
                <div className={`absolute -top-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center shadow-md animate-spin duration-[3s] ${
                  rideMode === "female-only" ? "bg-pink-500" : "bg-blue-500"
                }`}>
                  <div className="w-1.5 h-1.5 bg-white rounded-full" />
                </div>
              </div>
              <h1 className={`text-center font-bold text-xl mb-2 tracking-tight ${rideMode === "female-only" ? "text-pink-600" : "text-zinc-900"}`}>
                {rideMode === "female-only" ? "Safe Mode Active" : "Finding Your Ride"}
              </h1>
              <p className="text-zinc-500 text-sm font-medium text-center max-w-[200px] mb-6">
                {rideMode === "female-only" ? "Searching for verified female captains nearby..." : "Matching you with the closest captain for a quick pickup."}
              </p>
              <div className="w-full h-1.5 rounded-full bg-zinc-100 overflow-hidden shadow-inner">
                <div className={`h-full animate-progress rounded-full active-progress ${
                  rideMode === "female-only" ? "bg-gradient-to-r from-pink-400 to-pink-600" : "bg-gradient-to-r from-blue-400 to-blue-600"
                }`} style={{ width: '40%' }}></div>
              </div>
            </div>
          )}

          {rideStatus === "arrived" && (
            <div className={`p-4 rounded-2xl mb-6 border-2 animate-bounce shadow-xl flex items-center gap-3 ${
              rideMode === "female-only" ? "bg-pink-100 border-pink-200 text-pink-800" : "bg-emerald-50 border-emerald-100 text-emerald-800"
            }`}>
                <div className={`p-2 rounded-xl ${rideMode === "female-only" ? "bg-pink-200" : "bg-emerald-200"}`}>
                   <ShieldCheck size={20} />
                </div>
                <h1 className="text-xs font-bold uppercase tracking-tight">Your captain has arrived! Share OTP to start.</h1>
            </div>
          )}

          {confirmedRideData?._id && (
            <div className="bg-zinc-50 rounded-[24px] p-5 mb-6 border border-zinc-100">
              <div className="flex justify-between items-start mb-4">
                <div className={`relative p-3 rounded-2xl ${rideMode === "female-only" ? "bg-pink-100/50" : "bg-white shadow-sm"}`}>
                  <img
                    src={selectedVehicle === "car" ? "/car.png" : `/${selectedVehicle}.webp`}
                    className="h-16 object-contain"
                  />
                  <div className="absolute -bottom-2 -right-2 bg-black text-white text-[8px] px-2 py-0.5 rounded-full font-bold">
                     {selectedVehicle.toUpperCase()}
                  </div>
                </div>
                
                <div className="text-right">
                  <h1 className="text-lg font-bold tracking-tight text-zinc-900">
                    {confirmedRideData?.captain?.fullname?.firstname} {confirmedRideData?.captain?.fullname?.lastname}
                  </h1>
                  <div className="flex items-center justify-end gap-1.5 mt-0.5">
                    <div className="flex items-center gap-0.5 bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-lg text-[10px] font-bold">
                       ⭐ {confirmedRideData?.captain?.avgSafetyScore || "4.8"}
                    </div>
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">{confirmedRideData?.captain?.vehicle?.color} {confirmedRideData?.captain?.vehicle?.type}</span>
                  </div>
                  <h2 className="text-sm font-bold text-zinc-950 mt-1 uppercase tracking-tighter bg-zinc-200 px-2 py-0.5 rounded-lg inline-block">
                    {confirmedRideData?.captain?.vehicle?.number}
                  </h2>
                </div>
              </div>

              {rideStatus !== "ongoing" && (
                <div className="flex items-center justify-between bg-zinc-900 p-3 rounded-xl mb-4 text-white">
                  <span className="text-[10px] font-bold uppercase tracking-widest opacity-60">Security OTP</span>
                  <span className="text-xl font-bold tracking-[4px]">{confirmedRideData?.otp}</span>
                </div>
              )}

              <div className="flex gap-2 mb-2">
                <div className="flex-1">
                  <Button
                    type={"link"}
                    path={`/user/chat/${confirmedRideData?._id}`}
                    title={"Message..."}
                    icon={<SendHorizontal size={16} />}
                    classes={"bg-white font-bold text-xs text-zinc-800 border-zinc-100 shadow-sm"}
                  />
                </div>
                <a 
                  href={"tel:" + confirmedRideData?.captain?.phone}
                  className="w-12 h-12 flex items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-500/20 active:scale-90 transition-all"
                >
                  <PhoneCall size={18} />
                </a>
              </div>
            </div>
          )}

          <div className="space-y-4 mb-8">
            <div className="relative pl-8 border-l-2 border-dashed border-zinc-200 ml-2 space-y-6 py-2">
               <div className="absolute -left-[11px] top-0 w-5 h-5 rounded-full bg-emerald-500 border-4 border-white shadow-md z-10" />
               <div className="absolute -left-[11px] bottom-0 w-5 h-5 rounded-full bg-red-500 border-4 border-white shadow-md z-10" />
               
               <div className="group">
                  <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Pickup</p>
                  <h3 className="text-sm font-bold text-zinc-900 line-clamp-2 leading-tight group-hover:text-emerald-600 transition-colors">
                    {pickupLocation}
                  </h3>
               </div>

               <div className="group">
                  <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Destination</p>
                  <h3 className="text-sm font-bold text-zinc-900 line-clamp-2 leading-tight group-hover:text-red-600 transition-colors">
                    {destinationLocation}
                  </h3>
               </div>
            </div>

            <div className="flex items-center justify-between p-4 rounded-2xl bg-zinc-50 border border-zinc-100 group hover:bg-white hover:shadow-md transition-all">
               <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-white rounded-xl shadow-sm group-hover:scale-110 transition-transform">
                    <CreditCard size={20} className="text-zinc-600" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-zinc-900 tracking-tight">₹ {fare[selectedVehicle]}</h3>
                    <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Payment via Cash</p>
                  </div>
               </div>
               <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            </div>
          </div>

          <div className="space-y-3">
            {confirmedRideData?._id && (
              <Button
                title={"Share Tracking Link"}
                classes={rideMode === "female-only" ? "bg-pink-100 text-pink-700 font-black border border-pink-200" : "bg-blue-600 text-white font-black shadow-lg shadow-blue-500/20"}
                icon={<Share2 size={18} />}
                fun={() => {
                  const link = `${window.location.origin}/track/${confirmedRideData._id}`;
                  if (navigator.share) {
                    navigator.share({
                      title: 'Track My Ride',
                      text: 'Follow my live ride location on SAARTHI! 🚗',
                      url: link,
                    }).catch(console.error);
                  } else {
                    navigator.clipboard.writeText(link);
                    alert("Tracking link copied to clipboard: " + link);
                  }
                }}
              />
            )}
            
            {rideCreated || confirmedRideData ? (
              <button
                onClick={cancelRide}
                disabled={loading}
                className="w-full py-4 rounded-2xl bg-zinc-100 font-bold text-sm text-red-600 hover:bg-red-50 active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                {loading ? <div className="w-5 h-5 border-2 border-red-200 border-t-red-600 rounded-full animate-spin" /> : "Cancel Trip"}
              </button>
            ) : (
              <Button 
                  title={"Confirm Ride"} 
                  fun={createRide} 
                  loading={loading} 
                  classes={rideMode === "female-only" ? "bg-gradient-to-r from-pink-500 to-pink-600 border-none shadow-xl shadow-pink-500/30 font-bold h-14" : "bg-zinc-950 font-bold h-14 shadow-xl shadow-black/20"}
              />
            )}
          </div>
      </div>
    </div>
  );
}

export default RideDetails;
