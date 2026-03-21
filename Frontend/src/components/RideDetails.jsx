import {
  CreditCard,
  MapPinMinus,
  MapPinPlus,
  PhoneCall,
  SendHorizontal,
  ArrowLeft,
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
}) {
  if (!showPanel) return null;

  return (
    <div className="w-full bg-white flex flex-col">
      {!rideCreated && (
        <div className="flex items-center px-4 py-3 border-b mb-2">
            <button 
                onClick={() => {
                    setShowPanel(false);
                    showPreviousPanel(true);
                }}
                className="p-2 hover:bg-zinc-100 rounded-full transition-colors mr-2"
            >
                <ArrowLeft size={20} />
            </button>
            <h2 className="text-lg font-bold">Confirm your ride</h2>
        </div>
      )}
      <div className="px-4 pb-4">
          {rideCreated && !confirmedRideData && (
            <>
              <h1 className="text-center">Looking for nearby drivers</h1>
              <div className="overflow-y-hidden py-2 pb-2">
                <div className="h-1 rounded-full bg-blue-500 animate-ping"></div>
              </div>
            </>
          )}
          {rideStatus === "arrived" && (
            <div className="bg-yellow-100 p-3 rounded-lg mb-4 border-2 border-yellow-200">
                <h1 className="text-sm font-semibold text-yellow-800 text-center">Your captain has arrived. Please share OTP to start ride.</h1>
            </div>
          )}
          {rideStatus === "accepted" && (
            <div className="bg-blue-50 p-3 rounded-lg mb-4 border-2 border-blue-100">
                <h1 className="text-sm font-semibold text-blue-800 text-center">Captain is arriving 🚗</h1>
            </div>
          )}
          <div
            className={`flex ${
              confirmedRideData ? " justify-between " : " justify-center "
            } pt-2 pb-4`}
          >
            <div>
              <img
                src={
                  selectedVehicle == "car"
                    ? "/car.png"
                    : `/${selectedVehicle}.webp`
                }
                className={`${confirmedRideData ? " h-20" : " h-12 "}`}
              />
            </div>

            {confirmedRideData?._id && (
              <div className="leading-4 text-right">
                <h1 className="text-sm font-semibold">
                  {confirmedRideData?.captain?.fullname?.firstname}{" "}
                  {confirmedRideData?.captain?.fullname?.lastname}
                </h1>
                <div className="flex items-center justify-end gap-1 mt-0.5">
                  <span className="text-xs font-bold text-yellow-600">
                    ⭐ {confirmedRideData?.captain?.avgSafetyScore || "N/A"}{" "}
                    Safety Rating
                  </span>
                  {confirmedRideData?.captain?.avgSafetyScore > 4 && (
                    <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-bold border border-green-200">
                      Highly Rated
                    </span>
                  )}
                </div>
                <h1 className="font-medium text-sm mt-1">
                  {confirmedRideData?.captain?.vehicle?.number}
                </h1>
                <h1 className="capitalize text-xs text-zinc-400">
                  {" "}
                  {confirmedRideData?.captain?.vehicle?.color}{" "}
                  {confirmedRideData?.captain?.vehicle?.type}
                </h1>
                <span className="mt-2 inline-block bg-black text-white px-3 py-1 rounded-lg text-sm font-bold">
                  OTP: {confirmedRideData?.otp}
                </span>
              </div>
            )}
          </div>
          {confirmedRideData?._id && (
            <div className="flex gap-2 mb-2">
              <Button
                type={"link"}
                path={`/user/chat/${confirmedRideData?._id}`}
                title={"Send a message..."}
                icon={<SendHorizontal strokeWidth={1.5} size={18} />}
                classes={"bg-zinc-100 font-medium text-sm text-zinc-950"}
              />
              <div className="flex items-center justify-center w-14 rounded-md bg-zinc-100">
                <a href={"tel:" + confirmedRideData?.captain?.phone}>
                  <PhoneCall size={18} strokeWidth={2} color="black" />
                </a>
              </div>
            </div>
          )}
          <div className="mb-2">
            {/* Pickup Location */}
            <div className="flex items-center gap-3 border-t-2 py-2 px-2">
              <MapPinMinus size={18} />
              <div>
                <h1 className="text-lg font-semibold leading-5">
                  {pickupLocation.split(", ")[0]}
                </h1>
                <div className="flex">
                  <p className="text-xs text-gray-800 inline">
                    {pickupLocation.split(", ").map((location, index) => {
                      if (index > 0) {
                        return (
                          <span key={index}>
                            {location}
                            {index < pickupLocation.split(", ").length - 1 &&
                              ", "}
                          </span>
                        );
                      }
                      return null;
                    })}
                  </p>
                </div>
              </div>
            </div>

            {/* Destination Location */}
            <div className="flex items-center gap-3 border-t-2 py-2 px-2">
              <MapPinPlus size={18} />
              <div>
                <h1 className="text-lg font-semibold leading-5">
                  {destinationLocation.split(", ")[0]}
                </h1>
                <div className="flex">
                  <p className="text-xs text-gray-800 inline">
                    {destinationLocation.split(", ").map((location, index) => {
                      if (index > 0) {
                        return (
                          <span key={index}>
                            {location}
                            {index <
                              destinationLocation.split(", ").length - 1 &&
                              ", "}
                          </span>
                        );
                      }
                      return null;
                    })}
                  </p>
                </div>
              </div>
            </div>

            {/* Fare */}
            <div className="flex items-center gap-3 border-t-2 py-2 px-2">
              <CreditCard size={18} />
              <div>
                <h1 className="text-lg font-semibold leading-6">
                  ₹ {fare[selectedVehicle]}
                </h1>
                <p className="text-xs text-gray-800 ">Cash</p>
              </div>
            </div>
          </div>
          {rideCreated || confirmedRideData ? (
            <Button
              title={"Cancel Ride"}
              loading={loading}
              classes={"bg-red-600 "}
              fun={cancelRide}
            />
          ) : (
            <Button title={"Confirm Ride"} fun={createRide} loading={loading} />
          )}
        </div>
      </div>
    );
}

export default RideDetails;
