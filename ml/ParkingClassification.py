class ParkingSpot:
    def __init__(self, cars_detected, camera_id, parking_class="Student"):
        # default parking will be student and only change when camera is looking at others
        self.parking_class = parking_class
        self.cars_detected = cars_detected
        self.camera = camera_id

    def open_spots(self):
        # will be the metadata/name of the camera to determine where the camera is
        match self.camera:
            case 1:
                spots = 1
                self.parking_class = "Staff"
            case 2:
                spots = 2
        return spots 

    def spot_calculation(self):
        spots = self.open_spots()
        total = spots - self.cars_detected
        # final function that returns amount of spots available, the type of spots,
        # and the camera metadata to determine the section for the camera
        return total, self.parking_class, self.camera