import { FlightViewModel } from "@/app/actions";
import { IconType } from "react-icons";
import { BiErrorCircle, BiInfoCircle } from "react-icons/bi";

export type FlightInfo = {
  type: "warning" | "delay" | "info" | "success";
  message: string;
  icon: IconType;
};

function getTimeDifferenceInMinutes(flight: FlightViewModel) {
  if (!flight.status_time) return 0;
  const diffMs = flight.status_time?.getTime() - flight.schedule_time.getTime();
  return Math.floor(diffMs / 60000);
}

export default function getFlightNotifications(
  flight: FlightViewModel,
  direction: "A" | "D",
) {
  const notifications: FlightInfo[] = [];

  const rules = [
    {
      condition: direction === "D" && flight.dom_int === "I",
      result: { type: "info", message: "Passport Control", icon: BiInfoCircle },
    },
    {
      condition:
        flight.status_time &&
        flight.status_code == "E" &&
        getTimeDifferenceInMinutes(flight) >= 10 &&
        getTimeDifferenceInMinutes(flight) < 60,
      result: { type: "delay", message: "Minor delay", icon: BiInfoCircle },
    },
    {
      condition:
        flight.status_time &&
        flight.status_code == "E" &&
        getTimeDifferenceInMinutes(flight) >= 60 &&
        getTimeDifferenceInMinutes(flight) < 180,
      result: { type: "delay", message: "Moderate delay", icon: BiErrorCircle },
    },
    {
      condition:
        flight.status_time &&
        flight.status_code == "E" &&
        getTimeDifferenceInMinutes(flight) >= 180,
      result: { type: "warning", message: "Major delay", icon: BiErrorCircle },
    },
  ];

  rules.forEach((rule) => {
    if (rule.condition) {
      notifications.push(rule.result as FlightInfo);
    }
  });

  return notifications;
}
