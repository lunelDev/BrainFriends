import { REHAB_PROTOCOLS } from "@/constants/auditoryTrainingData";
import { PlaceType } from "@/constants/trainingData";

export function buildStep1TrainingData(place: PlaceType) {
  const protocol = REHAB_PROTOCOLS[place] || REHAB_PROTOCOLS.home;
  const combined = [...protocol.basic, ...protocol.intermediate, ...protocol.advanced];
  return combined.sort(() => Math.random() - 0.5).slice(0, 10);
}
