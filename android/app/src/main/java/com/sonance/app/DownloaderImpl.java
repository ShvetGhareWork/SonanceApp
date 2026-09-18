package com.sonance.app;

import androidx.annotation.NonNull;

import org.schabi.newpipe.extractor.downloader.Downloader;
import org.schabi.newpipe.extractor.downloader.Request;
import org.schabi.newpipe.extractor.downloader.Response;
import org.schabi.newpipe.extractor.exceptions.ReCaptchaException;

import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeUnit;

import okhttp3.OkHttpClient;
import okhttp3.RequestBody;
import okhttp3.ResponseBody;

public class DownloaderImpl extends Downloader {

    private static DownloaderImpl instance;
    private final OkHttpClient client;
    private static final String DEFAULT_USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36";

    private DownloaderImpl(OkHttpClient.Builder builder) {
        this.client = builder
                .connectTimeout(30, TimeUnit.SECONDS)
                .readTimeout(30, TimeUnit.SECONDS)
                .build();
    }

    public static synchronized DownloaderImpl init(OkHttpClient.Builder builder) {
        if (instance == null) {
            instance = new DownloaderImpl(builder != null ? builder : new OkHttpClient.Builder());
        }
        return instance;
    }

    public static synchronized DownloaderImpl getInstance() {
        if (instance == null) {
            instance = init(new OkHttpClient.Builder());
        }
        return instance;
    }

    @Override
    public Response execute(@NonNull Request request) throws IOException, ReCaptchaException {
        String httpMethod = request.httpMethod();
        String url = request.url();
        Map<String, List<String>> headers = request.headers();
        byte[] dataToSend = request.dataToSend();

        okhttp3.Request.Builder requestBuilder = new okhttp3.Request.Builder()
                .url(url);

        boolean hasUserAgent = false;
        if (headers != null) {
            for (Map.Entry<String, List<String>> header : headers.entrySet()) {
                String headerName = header.getKey();
                if ("User-Agent".equalsIgnoreCase(headerName)) {
                    hasUserAgent = true;
                }
                for (String headerValue : header.getValue()) {
                    requestBuilder.addHeader(headerName, headerValue);
                }
            }
        }

        if (!hasUserAgent) {
            requestBuilder.addHeader("User-Agent", DEFAULT_USER_AGENT);
        }

        RequestBody requestBody = null;
        if (dataToSend != null) {
            requestBody = RequestBody.create(dataToSend, null);
        }

        if (httpMethod.equalsIgnoreCase("HEAD")) {
            requestBuilder.head();
        } else if (httpMethod.equalsIgnoreCase("POST")) {
            requestBuilder.post(requestBody != null ? requestBody : RequestBody.create(new byte[0], null));
        } else if (httpMethod.equalsIgnoreCase("PUT")) {
            requestBuilder.put(requestBody != null ? requestBody : RequestBody.create(new byte[0], null));
        } else if (httpMethod.equalsIgnoreCase("DELETE")) {
            requestBuilder.delete(requestBody);
        } else {
            requestBuilder.get();
        }

        okhttp3.Response response = client.newCall(requestBuilder.build()).execute();

        ResponseBody responseBody = response.body();
        String responseBodyString = responseBody != null ? responseBody.string() : "";

        return new Response(
                response.code(),
                response.message(),
                response.headers().toMultimap(),
                responseBodyString,
                response.request().url().toString()
        );
    }
}
