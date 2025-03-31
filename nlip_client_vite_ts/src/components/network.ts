import { Message } from "@/components/message";

export async function postMessage(msg: Message): Promise<any> {
  try {
    const response = await fetch("https://druid.eecs.umich.edu/nlip", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(msg),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const responseData = await response.json();
    return responseData;
  } catch (error) {
    console.error("Error:", error);
  }
}
