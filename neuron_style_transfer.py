import cv2
import imutils
import time

model_path = "models/eccv16/the_wave.t7"
net = cv2.dnn.readNetFromTorch(model_path)

image = cv2.imread("images/monalisa.jpg")
image = imutils.resize(image, width=600)
(h, w) = image.shape[:2]

blob = cv2.dnn.blobFromImage(image, 1.0, (w, h),
    (103.939, 116.779, 123.680), swapRB=False, crop=False)
net.setInput(blob)

start = time.time()
output = net.forward()
print(f"NST took {time.time() - start:.2f}s")

output = output.reshape(3, output.shape[2], output.shape[3])
output[0] += 103.939
output[1] += 116.779
output[2] += 123.680
output = output.transpose(1, 2, 0)
cv2.imwrite("images_val/1.jpg", output)